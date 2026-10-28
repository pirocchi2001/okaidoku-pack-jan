# マニュアル用のスクリーンショットを撮る（実際のツールを headless Chrome で表示）
import subprocess, tempfile, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
TOOL = os.path.join(HERE, "..", "jan-card-print.html")
CH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
tmp = tempfile.mkdtemp()
SHOTS = {   # 名前: (画面の操作, 幅, 高さ)
    "main":  ("sets = sampleSets(); cur = 1; save(); refresh(true); window.scrollTo(0, 0);", 1280, 900),
    "print": ("sets = sampleSets(); save(); refresh(true); openPrint();", 1280, 900),
    "error": ("sets = sampleSets(); sets[1].jans += '\\n4901234500098'; sets[1].yori = ''; cur = 1; save(); refresh(true);", 1280, 900),
}
src = open(TOOL, encoding="utf-8").read()
for name, (js, w, h) in SHOTS.items():
    page = os.path.join(tmp, name + ".html")
    open(page, "w", encoding="utf-8").write(src.replace("</body>", "<script>" + js + "</script></body>"))
    subprocess.run([CH, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=" + os.path.join(tmp, "p_" + name),
                    "--virtual-time-budget=6000", "--force-device-scale-factor=2", f"--window-size={w},{h}",
                    "--screenshot=" + os.path.join(HERE, "shots", name + ".png"), "file://" + page], check=True, capture_output=True)
    print("shot", name)

# カードの拡大画像：実際の印刷PDFから 500円・対象外 のカード（1ページ目 3段目左）を切り出す
page = os.path.join(tmp, "card.html")
open(page, "w", encoding="utf-8").write(src.replace("</body>", "<script>sets = sampleSets(); save(); refresh(true);</script></body>"))
pdf = os.path.join(tmp, "card.pdf")
subprocess.run([CH, "--headless=new", "--disable-gpu", "--user-data-dir=" + os.path.join(tmp, "p_card"), "--virtual-time-budget=6000",
                "--no-pdf-header-footer", "--print-to-pdf=" + pdf, "file://" + page], check=True, capture_output=True)
mm = 300 / 25.4
subprocess.run(["pdftoppm", "-r", "300", "-png", "-singlefile", "-f", "1", "-l", "1", "-x", str(int(4 * mm)), "-y", str(int(184 * mm)),
                "-W", str(int(102 * mm)), "-H", str(int(57 * mm)), pdf, os.path.join(HERE, "shots", "card")], check=True)
print("shot card")
