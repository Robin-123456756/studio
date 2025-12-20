from pathlib import Path
from PyPDF2 import PdfReader

paths = [
    r"C:\Users\Emma.K\Downloads\Budo_League_App_Spec_Snapshot_v0_11.pdf",
    r"C:\Users\Emma.K\Downloads\Budo_League_App_Living_Spec_v0_11.pdf",
]
out = []
for p in paths:
    path = Path(p)
    if not path.exists():
        out.append(f"MISSING: {p}\n")
        continue
    reader = PdfReader(str(path))
    text = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            text.append(t)
    text = "\n".join(text)
    out.append(f"---FILE: {p}---\n")
    out.append(text[:20000])
    out.append("\n\n")

res = "\n".join(out)
open('tmp/specs_extracted.txt','w',encoding='utf-8').write(res)
print('WROTE tmp/specs_extracted.txt')
