"""Text cleaning utilities."""
import re


# ─── General text cleaning ──────────────────────────────────────

def clean_text(text: str) -> str:
    """Clean extracted text by removing noise and normalizing."""
    # Remove excessive whitespace
    text = re.sub(r'[ \t]+', ' ', text)

    # Normalize newlines (max 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Remove common header/footer patterns
    text = re.sub(r'^\d+/\d+$', '', text, flags=re.MULTILINE)

    # Normalize Chinese/English punctuation
    text = text.replace('　', ' ')

    # Remove control characters (keep common ones)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # Remove lines that are just page numbers
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)

    # Remove watermark-like content (simple heuristics)
    text = re.sub(r'第\s*\d+\s*页', '', text)

    return text.strip()


def remove_empty_lines(text: str) -> str:
    """Remove completely empty lines."""
    lines = text.split('\n')
    return '\n'.join(line for line in lines if line.strip())


def normalize_punctuation(text: str) -> str:
    """Normalize Chinese and English punctuation."""
    # Standardize English quotes
    text = text.replace('“', '"').replace('”', '"')
    text = text.replace('‘', "'").replace('’', "'")

    return text


# ─── PDF-specific cleaning ──────────────────────────────────────

# Sentence-ending punctuation in Chinese and English
_SENTENCE_ENDS = re.compile(r'[。！？.!?…」』”"）\)】〗]$')

# CJK character pattern
_CJK = re.compile(r'[一-鿿㐀-䶿豈-﫿]')

# Inter-CJK whitespace: spaces/tabs between two CJK chars
_INTER_CJK_SPACE = re.compile(r'(?<=[一-鿿㐀-䶿豈-﫿])'
                              r'[ \t]+'
                              r'(?=[一-鿿㐀-䶿豈-﫿])')

# Common PDF header/footer patterns for Chinese docs
_PDF_HEADER_FOOTER_PATTERNS = [
    re.compile(r'^\s*(GB[/\s]?T|GB|GBT)\s*[\d.]+\s*[-—–]\s*\d{4}\s*$', re.IGNORECASE),  # Standard number
    re.compile(r'^[A-Z]{2,4}[/\s]?T?\s*[\d.]+[-—–]\d{4}$'),  # ISO/GB standard code
    re.compile(r'^\s*ICS\s*[\d.]+\s*$'),  # ICS classification
    re.compile(r'^\s*中华人民共和国国家标准\s*$'),  # Title page
    re.compile(r'^\s*国家市场监督管理总局\s*.*\s*发布\s*$'),  # Issuing authority
    re.compile(r'^\s*[\d\-]+\s*实施\s*$'),  # Implementation date
    re.compile(r'^\s*(发布|实施|代替)\s*$'),  # Single keywords
    re.compile(r'^\d{1,3}\s*$'),  # Bare page numbers
    re.compile(r'^[①②③④⑤⑥⑦⑧⑨⑩]\s*$'),  # Circled numbers
]


def clean_pdf_text(text: str) -> str:
    """Clean text extracted from PDF files.

    Handles common PDF extraction artifacts:
    - Broken lines within paragraphs (merged when prev line has no sentence end)
    - Excessive spacing between CJK characters
    - Page headers, footers, running titles
    - Encoding artifacts
    """
    if not text:
        return text

    # Step 1: Remove inter-CJK whitespace (single-glyph extraction artifact)
    text = _INTER_CJK_SPACE.sub('', text)

    # Step 2: Merge broken lines within paragraphs.
    # PDF extraction often breaks each visual line into a separate text line.
    # We merge consecutive lines where the previous doesn't end with sentence-ending punctuation.
    lines = text.split('\n')
    merged = []
    buffer = ''

    for line in lines:
        stripped = line.strip()
        if not stripped:
            # Empty line → paragraph break; flush buffer
            if buffer:
                merged.append(buffer)
                buffer = ''
            merged.append('')
            continue

        if not buffer:
            buffer = stripped
        elif _SENTENCE_ENDS.search(buffer[-2:] if len(buffer) >= 2 else buffer):
            # Previous line appears to end a sentence → start new line
            merged.append(buffer)
            buffer = stripped
        else:
            # Previous line doesn't end with sentence punctuation → merge
            # Check if it looks like a heading (short and starts with numbering)
            looks_like_heading = (
                len(stripped) < 30 and
                bool(re.match(r'^[\d一二三四五六七八九十（(第]', stripped))
            )
            if looks_like_heading:
                # Flush buffer, start new section
                if buffer:
                    merged.append(buffer)
                buffer = stripped
            else:
                buffer += stripped

    if buffer:
        merged.append(buffer)

    text = '\n'.join(merged)

    # Step 3: Remove PDF header/footer lines
    for pattern in _PDF_HEADER_FOOTER_PATTERNS:
        text = pattern.sub('', text)

    # Step 4: Clean up triple+ newlines
    text = re.sub(r'\n{3,}', '\n\n', text)

    # Step 5: Remove lines that are purely whitespace
    text = remove_empty_lines(text)

    return text.strip()
