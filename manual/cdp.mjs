// Chrome を DevTools プロトコルで操作する（実時間で動かす・スマホの画面幅で撮る）
//   node cdp.mjs <url> <式|sleep:ミリ秒|shot:保存先.png> ...   環境変数 MOBILE=1 で 390x844 のスマホ表示
const [,, url, ...exprs] = process.argv;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) { try { targets = await (await fetch("http://127.0.0.1:9333/json")).json(); break; } catch { await sleep(200); } }
const page = targets.find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl); let id = 0; const waits = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (waits[m.id]) { waits[m.id](m); delete waits[m.id]; } };
await new Promise(r => ws.onopen = r);
const send = (method, params = {}) => new Promise(r => { const i = ++id; waits[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
if (process.env.MOBILE) await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url }); await sleep(2500);
for (const ex of exprs) {
  if (/^sleep:/.test(ex)) { await sleep(+ex.slice(6)); continue; }
  if (/^shot:/.test(ex)) {
    const r = await send("Page.captureScreenshot", { format: "png" });
    (await import("node:fs")).writeFileSync(ex.slice(5), Buffer.from(r.result.data, "base64")); console.log("shot " + ex.slice(5)); continue;
  }
  const r = await send("Runtime.evaluate", { expression: ex, awaitPromise: true, returnByValue: true });
  console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? r));
}
ws.close(); process.exit(0);
