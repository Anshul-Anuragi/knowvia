import io
from typing import Union, List, Tuple
from pypdf import PdfReader


def extract_pages_from_pdf(
    source: Union[str, bytes, io.BytesIO]
) -> List[Tuple[int, str]]:
    """
    Extracts text per page, returning a list of (page_number, text) tuples (1-indexed).
    """
    if isinstance(source, bytes):
        stream = io.BytesIO(source)
        reader = PdfReader(stream)
    elif isinstance(source, io.BytesIO):
        reader = PdfReader(source)
    else:
        reader = PdfReader(source)

    pages = []
    for idx, page in enumerate(reader.pages, 1):
        page_text = (page.extract_text() or "").strip()
        pages.append((idx, page_text))

    return pages


def extract_text_from_pdf(
    source: Union[str, bytes, io.BytesIO]
) -> str:
    pages = extract_pages_from_pdf(source)
    return "\n\n".join([text for _, text in pages if text]).strip()
