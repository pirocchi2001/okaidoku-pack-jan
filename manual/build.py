# manual.html → manual.pdf を作り、jan-card-print.html の MANUAL_PDF に埋め込む
#   使い方: python3 manual/build.py   （先に shots.py → crop.sh で画面写真を更新しておく）
import base64, os, re, subprocess, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, "..", "jan-card-print.html")
PDF = os.path.join(HERE, "manual.pdf")
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
subprocess.run([CH, "--headless=new", "--disable-gpu", "--user-data-dir=" + tempfile.mkdtemp(), "--virtual-time-budget=8000",
                "--no-pdf-header-footer", "--print-to-pdf=" + PDF, "file://" + os.path.join(HERE, "manual.html")], check=True, capture_output=True)
b64 = base64.b64encode(open(PDF, "rb").read()).decode()
src = open(TOOL, encoding="utf-8").read()
src, n = re.subn(r'/\*MANUAL_PDF\*/".*?"/\*/MANUAL_PDF\*/', lambda m: '/*MANUAL_PDF*/"' + b64 + '"/*/MANUAL_PDF*/', src, flags=re.S)
assert n == 1, "MANUAL_PDF の目印が見つかりません"
open(TOOL, "w", encoding="utf-8").write(src)
print(f"manual.pdf {os.path.getsize(PDF)//1024}KB → jan-card-print.html に埋め込みました")
