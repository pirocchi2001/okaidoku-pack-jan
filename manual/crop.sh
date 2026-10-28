#!/bin/sh
# スクリーンショットからマニュアル用の部分を切り出して JPEG にする（座標は 2560x1800 の画像上）
cd "$(dirname "$0")/shots"
crop() { sips -c "$4" "$5" --cropOffset "$3" "$2" "$1.png" --out "/tmp/_c.png" >/dev/null && sips -s format jpeg -s formatOptions 82 /tmp/_c.png --out "../img/$6.jpg" >/dev/null; }
mkdir -p ../img
#     元     x     y     高さ  幅    出力
crop main  0     0     1800  2560  main
crop steps 1668  168   1910  845   editor
crop error 1790  860   640   720   error
crop print 640   64    1250  1280  print
crop pdfpv  520   62    1738  1520  pdfpv
crop link  1700  1500  510   780   link
sips -s format jpeg -s formatOptions 82 phone_ok.png --out ../img/phone_ok.jpg >/dev/null
sips -s format jpeg -s formatOptions 82 phone_ng.png --out ../img/phone_ng.jpg >/dev/null
crop solo_edit 0 500 1080 780 solo_edit
crop solo_cam 0 0 1688 780 solo_cam
crop solo_pv 0 0 1688 780 solo_pv
sips -s format jpeg -s formatOptions 88 card.png --out ../img/card.jpg >/dev/null
sips -Z 1700 -s formatOptions 75 ../img/main.jpg >/dev/null
ls -la ../img
