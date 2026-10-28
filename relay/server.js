// スマホ → Mac → PC のJAN中継サーバー（依存パッケージなし）
//   PC（レジ指示カード）が「部屋」を作って6桁の番号を表示 → スマホがその番号でJANを送る → PCが取りに来る。
//   Tailscale Funnel で https://hiroshinomac-mini.tail387218.ts.net/jan/ として公開（127.0.0.1 のみで待ち受け）。
//   起動: node relay/server.js   （常駐は relay/com.okaidoku.janrelay.plist）
"use strict";
const http = require("http");
const crypto = require("crypto");

const PORT = +process.env.PORT || 3100;
const ROOM_TTL = 12 * 3600e3;        // 最後の操作から12時間で部屋を消す
const MAX_ROOMS = 200;
const MAX_EVENTS = 500;              // 1部屋に残すイベント数
const PC_ALIVE_MS = 6000;            // PCがこの時間内に取りに来ていれば「PC接続中」
const MISS_LIMIT = 30;               // 1分間に番号違いがこれを超えたIPは一時的に断る

const rooms = new Map();             // code -> { key, events:[{n,type,jan,ref,t}], seq, touched, pcSeen, pcInfo, closed }
const CLOSED_TTL = 600e3;            // PCが終えた部屋は10分だけ「終了」として残す（スマホにカメラを止めさせるため）
const misses = new Map();            // ip -> { n, since }

function checkDigit(body) {
  let s = 0;
  for (let i = 0; i < body.length; i++) { const d = +body[body.length - 1 - i]; s += i % 2 === 0 ? d * 3 : d; }
  return (10 - s % 10) % 10;
}
const validJan = j => typeof j === "string" && /^\d{13}$/.test(j) && checkDigit(j.slice(0, 12)) === +j[12];

function newCode() {
  for (;;) { const c = String(crypto.randomInt(0, 1e6)).padStart(6, "0"); if (!rooms.has(c)) return c; }
}
function sweep() {
  const now = Date.now();
  for (const [c, r] of rooms) if (now - r.touched > (r.closed ? CLOSED_TTL : ROOM_TTL)) rooms.delete(c);
  for (const [ip, m] of misses) if (now - m.since > 60e3) misses.delete(ip);
}
setInterval(sweep, 60e3).unref();

function send(res, status, obj) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, ng) => {
    let b = "";
    req.on("data", c => { b += c; if (b.length > 2048) { ng(new Error("too large")); req.destroy(); } });
    req.on("end", () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { ng(e); } });
  });
}
function clientIp(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
function blocked(ip) { const m = misses.get(ip); return m && m.n >= MISS_LIMIT && Date.now() - m.since < 60e3; }
function miss(ip) {
  const m = misses.get(ip);
  if (!m || Date.now() - m.since > 60e3) misses.set(ip, { n: 1, since: Date.now() }); else m.n++;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const url = new URL(req.url, "http://x");
  const path = url.pathname.replace(/^\/jan(?=\/|$)/, "") || "/";   // Tailscale が /jan を残しても外しても動くように
  const ip = clientIp(req);
  try {
    // 生存確認（スマホ・PCが「転送できるか」を調べる）
    if (req.method === "GET" && (path === "/" || path === "/health")) return send(res, 200, { ok: true, service: "jan-relay" });

    // PC：部屋を作る
    if (req.method === "POST" && path === "/rooms") {
      sweep();
      if (rooms.size >= MAX_ROOMS) return send(res, 503, { error: "busy" });
      const code = newCode(), key = crypto.randomBytes(18).toString("base64url");
      rooms.set(code, { key, events: [], seq: 0, touched: Date.now(), pcSeen: Date.now(), pcInfo: {} });
      return send(res, 200, { code, key });
    }

    const m = path.match(/^\/rooms\/(\d{6})(\/events|\/close)?$/);
    if (!m) return send(res, 404, { error: "not found" });
    if (blocked(ip)) return send(res, 429, { error: "too many" });
    const room = rooms.get(m[1]);
    if (!room) { miss(ip); return send(res, 404, { error: "no room" }); }

    // PC：連携を終える（key 必須）→ スマホは「終了」を見てカメラを止める
    if (req.method === "POST" && m[2] === "/close") {
      if (url.searchParams.get("key") !== room.key) { miss(ip); return send(res, 403, { error: "bad key" }); }
      room.closed = true; room.events = []; room.touched = Date.now();
      return send(res, 200, { ok: true });
    }
    if (room.closed) return send(res, 410, { error: "closed", closed: true });
    room.touched = Date.now();

    // PC：届いたJANを取りに来る（key 必須）。今どのセットに入れているかも伝える
    if (req.method === "GET" && m[2] === "/events") {
      if (url.searchParams.get("key") !== room.key) { miss(ip); return send(res, 403, { error: "bad key" }); }
      const after = +url.searchParams.get("after") || 0;
      room.pcSeen = Date.now();
      room.pcInfo = { set: String(url.searchParams.get("set") || "").slice(0, 20), count: +url.searchParams.get("count") || 0 };
      return send(res, 200, { events: room.events.filter(e => e.n > after), last: room.seq });
    }

    // スマホ：部屋の状態（PCがつながっているか・どのセットか）
    if (req.method === "GET") {
      return send(res, 200, { ok: true, pc: Date.now() - room.pcSeen < PC_ALIVE_MS, pcInfo: room.pcInfo, last: room.seq });
    }

    // スマホ：JANを送る {jan} ／ 取り消す {undo: n}
    if (req.method === "POST" && m[2] === "/events") {
      const b = await readBody(req);
      let ev;
      if (b.undo != null) {
        const target = room.events.find(e => e.n === +b.undo && e.type === "add");
        if (!target) return send(res, 404, { error: "no such scan" });
        ev = { type: "undo", jan: target.jan, ref: target.n };
      } else {
        if (!validJan(b.jan)) return send(res, 400, { error: "bad jan" });
        ev = { type: "add", jan: b.jan };
      }
      ev.n = ++room.seq; ev.t = Date.now();
      room.events.push(ev);
      if (room.events.length > MAX_EVENTS) room.events.splice(0, room.events.length - MAX_EVENTS);
      return send(res, 200, { ok: true, n: ev.n, pc: Date.now() - room.pcSeen < PC_ALIVE_MS, pcInfo: room.pcInfo });
    }
    return send(res, 405, { error: "method" });
  } catch (e) {
    return send(res, 400, { error: "bad request" });
  }
});
server.listen(PORT, "127.0.0.1", () => console.log(`jan-relay listening on 127.0.0.1:${PORT}`));
