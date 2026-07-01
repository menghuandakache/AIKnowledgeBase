"""Document parser service - extracts text from PDF, DOCX, and Markdown files."""
import os
import re
import logging
from app.core.exceptions import FileParseException

logger = logging.getLogger(__name__)

# Top 20 most frequent Chinese characters (by usage frequency in modern Chinese)
_COMMON_CHINESE_CHARS = set('的一是了不在有人上这大我国来们和个他中说到地为子以时生就也要会出对能下过可去')

# Commonly seen in Chinese docs but very rare in garbled CID-to-Unicode output
_VERY_COMMON_CHINESE = set('的是在了不有人')

# CJK Unified Ideographs range
_CJK_RANGE = re.compile(r'[一-鿿]')

# Excessive whitespace between CJK chars (sign of single-glyph decoding)
_CJK_SPACED_OUT = re.compile(r'[一-鿿]\s+[一-鿿]')


def _count_chinese_chars(text: str) -> int:
    """Count total CJK Unified Ideograph characters in text."""
    return len(_CJK_RANGE.findall(text))


def _count_chinese_sequences(text: str) -> int:
    """Count characters in valid CJK sequences (2+ consecutive CJK chars)."""
    matches = re.findall(r'[一-鿿]{2,}', text)
    return sum(len(m) for m in matches)


def _is_garbled(text: str) -> bool:
    """Heuristic: check if PDF text extraction produced garbled output.

    Uses multiple signals:
    0. Whitespace-only or near-empty meaningful content
    1. Too short / empty
    2. High rate of single-character lines (characters decoded one-by-one)
    3. Common Chinese characters absent despite many CJK chars
    4. Excessive whitespace between CJK characters
    5. U+FFFD replacement characters present
    6. Unusually high CJK character diversity (random CID mapping)
    """
    if not text or len(text) < 20:
        return True

    total = len(text)
    stripped_len = len(text.strip())

    # Signal 0: Whitespace-only or near-empty meaningful content
    if stripped_len < 10:
        return True
    # If >90% of the text is whitespace, it's effectively empty
    if total > 100 and stripped_len / total < 0.1:
        return True

    cjk_total = _count_chinese_chars(text)
    cjk_seq_chars = _count_chinese_sequences(text)

    # Signal 1: Less than 5% recognizable CJK sequences → likely garbled or non-Chinese
    if total > 100 and cjk_total > 0 and cjk_seq_chars / max(cjk_total, 1) < 0.3:
        return True

    # Signal 2: Too many single-char lines → characters decoded one-by-one
    lines = text.split('\n')
    non_empty_lines = [l for l in lines if l.strip()]
    if len(non_empty_lines) > 10:
        singles = sum(1 for l in non_empty_lines if len(l.strip()) == 1)
        if singles / len(non_empty_lines) > 0.5:
            return True

    # Signal 3: Common Chinese characters absent — strong signal for garbled CID output
    if cjk_total > 50:
        cjk_chars = _CJK_RANGE.findall(text)
        cjk_set = set(cjk_chars)
        common_found = _VERY_COMMON_CHINESE & cjk_set
        # If we have 50+ CJK chars but none of the 8 most common chars → garbled
        if len(common_found) == 0:
            return True
        # If we have 100+ CJK chars but fewer than 2 top-20 common chars → suspicious
        common_top20_found = _COMMON_CHINESE_CHARS & cjk_set
        if cjk_total > 100 and len(common_top20_found) < 2:
            return True

    # Signal 4: Excessive isolated CJK chars with whitespace between them
    spaced_out = len(_CJK_SPACED_OUT.findall(text))
    if cjk_total > 30 and spaced_out > cjk_total * 0.3:
        return True

    # Signal 5: Replacement characters (U+FFFD) — font mapping failure
    if '�' in text:
        # More than a handful of replacement chars → garbled
        if text.count('�') > 5:
            return True

    # Signal 6: Unusually high unique-CJK-char ratio (random CID output)
    if cjk_total > 100:
        unique_ratio = len(cjk_set) / cjk_total
        # Natural Chinese text has ~0.15-0.30 unique ratio within a page
        # Random CID mapping often has >0.5 unique ratio
        if unique_ratio > 0.55:
            return True

    return False


class ParserService:
    """Parses documents to extract plain text.

    PDF pipeline:
    1. PyMuPDF (fitz) — fast, handles most PDFs
    2. pdfplumber — better CMap/encoding handling for Chinese PDFs
    3. OCR (Tesseract) — image-based or unextractable PDFs
    """

    def parse(self, file_path: str, file_type: str) -> str:
        """Parse a document based on its type and return plain text."""
        if not os.path.exists(file_path):
            raise FileParseException(f"File not found: {file_path}")

        if file_type == "pdf":
            return self._parse_pdf(file_path)
        elif file_type == "docx":
            return self._parse_docx(file_path)
        elif file_type == "md":
            return self._parse_markdown(file_path)
        else:
            raise FileParseException(f"Unsupported file type: {file_type}")

    # ─── PDF parsing ───────────────────────────────────────────────

    def _parse_pdf(self, file_path: str) -> str:
        """Parse PDF with three-tier fallback: PyMuPDF → pdfplumber → OCR."""
        # Tier 1: PyMuPDF
        text = self._parse_pdf_pymupdf(file_path)
        if text and not _is_garbled(text):
            return text

        if text:
            logger.info(
                "PyMuPDF output flagged as garbled for %s (len=%d, cjk=%d). "
                "Trying pdfplumber...",
                os.path.basename(file_path), len(text),
                _count_chinese_chars(text),
            )

        # Tier 2: pdfplumber
        pdfplumber_text = self._parse_pdf_pdfplumber(file_path)
        if pdfplumber_text and not _is_garbled(pdfplumber_text):
            logger.info("pdfplumber succeeded for %s", os.path.basename(file_path))
            return pdfplumber_text

        if pdfplumber_text:
            logger.info(
                "pdfplumber output also flagged as garbled for %s. Trying OCR...",
                os.path.basename(file_path),
            )

        # Tier 3: OCR
        ocr_text = self._parse_pdf_ocr(file_path)
        if ocr_text:
            logger.info("OCR succeeded for %s", os.path.basename(file_path))
            return ocr_text

        # All tiers exhausted — return best available text
        logger.warning(
            "All extraction methods failed or produced garbled output for %s. "
            "Returning best-effort text.",
            os.path.basename(file_path),
        )
        return pdfplumber_text or text or ""

    def _parse_pdf_pymupdf(self, file_path: str) -> str:
        """Parse PDF using PyMuPDF (fitz)."""
        try:
            import fitz
            doc = fitz.open(file_path)
            texts = []
            for page in doc:
                # Use sort=True for correct reading order
                t = page.get_text("text", sort=True)
                if t.strip():
                    texts.append(t.strip())
            doc.close()
            return "\n\n".join(texts)
        except ImportError:
            raise FileParseException("PyMuPDF (fitz) not installed")
        except Exception as e:
            logger.warning("PyMuPDF failed for %s: %s", os.path.basename(file_path), e)
            return ""

    def _parse_pdf_pdfplumber(self, file_path: str) -> str:
        """Parse PDF using pdfplumber — often better for Chinese CJK-encoded PDFs."""
        try:
            import pdfplumber
            texts = []
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    t = page.extract_text()
                    if t and t.strip():
                        texts.append(t.strip())
            return "\n\n".join(texts)
        except ImportError:
            logger.info("pdfplumber not installed — skipping pdfplumber fallback")
            return ""
        except Exception as e:
            logger.warning("pdfplumber failed for %s: %s", os.path.basename(file_path), e)
            return ""

    def _parse_pdf_ocr(self, file_path: str) -> str:
        """OCR fallback for PDF files using Tesseract with Chinese support."""
        poppler_ok = True
        tesseract_ok = True

        try:
            from pdf2image import convert_from_path
        except ImportError:
            logger.info("pdf2image not installed — OCR unavailable")
            poppler_ok = False

        try:
            import pytesseract
        except ImportError:
            logger.info("pytesseract not installed — OCR unavailable")
            tesseract_ok = False

        if not poppler_ok or not tesseract_ok:
            return ""

        try:
            from pdf2image import convert_from_path
            import pytesseract

            # Convert pages (limit to keep parsing time reasonable)
            images = convert_from_path(file_path, first_page=1, last_page=50, dpi=200)
            logger.info(
                "OCR: converted %d pages from %s at 200 DPI",
                len(images), os.path.basename(file_path),
            )

            texts = []
            for i, img in enumerate(images):
                t = pytesseract.image_to_string(img, lang='chi_sim+eng')
                if t.strip():
                    texts.append(t.strip())

            result = "\n\n".join(texts)
            logger.info(
                "OCR extracted %d chars from %d pages of %s",
                len(result), len(images), os.path.basename(file_path),
            )
            return result
        except Exception as e:
            logger.warning("OCR failed for %s: %s", os.path.basename(file_path), e)
            return ""

    # ─── DOCX parsing ──────────────────────────────────────────────

    def _parse_docx(self, file_path: str) -> str:
        """Parse DOCX using python-docx."""
        try:
            from docx import Document
            doc = Document(file_path)
            paragraphs = []
            for para in doc.paragraphs:
                if para.text.strip():
                    paragraphs.append(para.text.strip())
            return "\n\n".join(paragraphs)
        except ImportError:
            raise FileParseException("python-docx is not installed")
        except Exception as e:
            raise FileParseException(f"Failed to parse DOCX: {str(e)}")

    # ─── Markdown parsing ──────────────────────────────────────────

    def _parse_markdown(self, file_path: str) -> str:
        """Parse Markdown file - strip formatting, keep text."""
        try:
            import markdown
            from html.parser import HTMLParser

            with open(file_path, "r", encoding="utf-8") as f:
                md_content = f.read()

            html = markdown.markdown(md_content)

            class MLStripper(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.reset()
                    self.strict = False
                    self.convert_charrefs = True
                    self.text = []

                def handle_data(self, d):
                    self.text.append(d)

                def get_data(self):
                    return "".join(self.text)

            stripper = MLStripper()
            stripper.feed(html)
            return stripper.get_data()
        except ImportError:
            raise FileParseException("markdown module is not installed")
        except Exception as e:
            raise FileParseException(f"Failed to parse Markdown: {str(e)}")
