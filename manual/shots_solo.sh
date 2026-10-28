#!/bin/sh
# 「スマホだけで作る」用の画面写真（スマホの画面幅・印刷したバーコードの画像をカメラに見せる）
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROF=$(mktemp -d)
"$CH" --headless=new --disable-gpu --use-fake-device-for-media-stream --use-fake-ui-for-media-stream \
  --use-file-for-fake-video-capture="$PWD/shots/barcode.y4m" --remote-debugging-port=9333 --user-data-dir="$PROF" about:blank >/dev/null 2>&1 &
CPID=$!
MOBILE=1 node cdp.mjs "file://$PWD/../jan-card-print.html?mobile=1" \
 'localStorage.clear(); sets=sampleSets(); sets.push(blank()); sets[7].price="500"; sets[7].yori="no"; cur=7; save(); refresh(true); window.scrollTo(0, $("fJans").getBoundingClientRect().top + scrollY - 330); "ok"' 'sleep:800' "shot:shots/solo_edit.png" \
 'openCam(); "cam"' 'sleep:6000' "shot:shots/solo_cam.png" 'closeCam(); window.scrollTo(0,0); "closed"' \
 'openPrint(); doPrint(); "pdf"' 'sleep:5000' "shot:shots/solo_pv.png"
kill $CPID
