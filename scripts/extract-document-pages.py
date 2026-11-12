# Pulls each page's text out of the customer PDFs in public/docs/ into
# lib/copper/data/document-pages.json, which search_documents reads.
# Run again after replacing a PDF:  python scripts/extract-document-pages.py
# Needs pypdf (pip install pypdf).
import json
import re
from pypdf import PdfReader

IDS = [
    "copper-home-user-guide",
    "copper-notes-user-guide",
    "copper-terms-and-conditions",
    "copper-plus-faq",
]

pages = []
for doc_id in IDS:
    for number, page in enumerate(PdfReader(f"public/docs/{doc_id}.pdf").pages, start=1):
        text = (page.extract_text() or "").replace("�", " ")
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        pages.append({"documentId": doc_id, "page": number, "text": text})

with open("lib/copper/data/document-pages.json", "w", encoding="utf-8") as out:
    json.dump({"pages": pages}, out, ensure_ascii=False, indent=1)
print(f"{len(pages)} pages written")
