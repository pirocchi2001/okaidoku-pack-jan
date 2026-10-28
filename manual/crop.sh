#!/bin/sh
# スクリーンショットからマニュアル用の部分を切り出して JPEG にする（座標は 2560x1800 の画像上）
cd "$(dirname "$0")/shots"
crop() { sips -c "$4" "$5" --cropOffset "$3" "$2" "$1.png" --out "/tmp/_c.png" >/dev/null && sips -s format jpeg -s formatOptions 82 /tmp/_c.png --out "../img/$6.jpg" >/dev/null; }
mkdir -p ../img
#     元     x     y     高さ  幅    出力
crop main  0     0     1800  2560  main
crop main  1790  166   1320  720   editor
crop error 1790  860   640   720   error
crop print 640   64    1250  1280  print
sips -s format jpeg -s formatOptions 88 card.png --out ../img/card.jpg >/dev/null
sips -Z 1700 -s formatOptions 75 ../img/main.jpg >/dev/null
ls -la ../img
