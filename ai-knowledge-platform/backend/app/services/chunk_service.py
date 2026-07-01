"""Chunk service - text splitting and chunk management."""
import re
from app.core.config import get_settings

settings = get_settings()


class ChunkService:
    """Splits text into chunks for embedding and retrieval."""

    # Supported chunk methods
    CHUNK_METHODS = {
        "auto": "自动检测（优先中文结构→标题→段落→固定长度）",
        "cn": "中文文档结构（第X章、X.X节）",
        "fixed": "固定长度切分",
        "h1": "Markdown 一级标题（#）",
        "h2": "Markdown 二级标题（##）",
        "h3": "Markdown 三级标题（###）",
        "sentence": "按句号切分（。！？.!?）",
        "paragraph": "按段落切分",
    }

    def split_text(self, text: str, method: str = "auto") -> list[dict]:
        """
        Split text into chunks based on the specified method.

        Methods:
        - auto: tries cn_structure → heading → paragraph → fixed (best-effort)
        - cn: Chinese document structure (第X章, X.X sections)
        - fixed: fixed character length with overlap
        - h1/h2/h3: markdown heading level 1/2/3
        - sentence: split by sentence delimiters
        - paragraph: split by blank lines (paragraphs)
        """
        if method == "fixed":
            return self._split_by_fixed_length(text)
        elif method == "cn":
            return self._split_by_cn_structure(text)
        elif method == "h1":
            return self._split_by_heading(text, level=1)
        elif method == "h2":
            return self._split_by_heading(text, level=2)
        elif method == "h3":
            return self._split_by_heading(text, level=3)
        elif method == "sentence":
            return self._split_by_sentence(text)
        elif method == "paragraph":
            return self._split_by_paragraph(text)
        else:
            # Auto: try cn_structure → heading → paragraph → fixed
            chunks = self._split_by_cn_structure(text)
            if len(chunks) <= 1:
                chunks = self._split_by_heading(text, level=None)
            if len(chunks) <= 1:
                chunks = self._split_by_paragraph(text)
            if len(chunks) <= 1:
                chunks = self._split_by_fixed_length(text)
            return chunks

    # ─── Chinese document structure detection ──────────────────────

    # Patterns for Chinese document structure
    _CN_HEADING_PATTERNS = [
        # 第X章, 第X节, 第X篇 (X = Chinese numerals or digits)
        re.compile(r'^第[一二三四五六七八九十百千\d]+[章节篇部]\b'),
        # Numbered sections with optional dot: "1.", "1.1", "1.1.1", "1 范围", "1.1 术语"
        re.compile(r'^\d+(?:\.\d+)*\.?\s+\S'),
        # Numbered markdown headings: "1. # Title", "1. ## Subtitle"
        re.compile(r'^\d+\.\s*#{1,4}\s'),
        # Chinese parenthetical: （一）, （二）, 一、, 二、
        re.compile(r'^（[一二三四五六七八九十]+）'),
        re.compile(r'^[一二三四五六七八九十]、'),
        # Appendix-style: 附录A, 附录B
        re.compile(r'^附录\s*[A-Za-z\d]'),
        # References / bibliography section headers
        re.compile(r'^(参考文献|参考标准|规范性引用文件|术语和定义|范围|前言|引言|目次)$'),
        # GB standard specific section markers
        re.compile(r'^\d+\s+(范围|规范性引用文件|术语和定义|符号|分类|要求|试验方法|检验规则|标志)'),
    ]

    def _is_cn_heading(self, line: str) -> bool:
        """Check if a line looks like a Chinese document section heading."""
        stripped = line.strip()
        if len(stripped) > 80:  # Headings are usually short
            return False
        for pattern in self._CN_HEADING_PATTERNS:
            if pattern.match(stripped):
                return True
        return False

    def _split_by_cn_structure(self, text: str) -> list[dict]:
        """
        Split text by Chinese document structure patterns.

        Detects:
        - 第X章 / 第X节 / 第X篇
        - Numbered sections: 1., 1.1, 1.1.1 with titles
        - Chinese numbering: 一、, （一）, etc.
        - Appendix markers
        - GB standard section headers
        """
        lines = text.split('\n')
        sections = []
        current_section = []
        current_heading = ''

        for line in lines:
            stripped = line.strip()
            if self._is_cn_heading(stripped):
                # Save previous section
                if current_section:
                    body = '\n'.join(current_section).strip()
                    if body:
                        sections.append((current_heading, body))
                current_heading = stripped
                current_section = []
            else:
                current_section.append(line)

        # Save last section
        if current_section:
            body = '\n'.join(current_section).strip()
            if body:
                sections.append((current_heading, body))

        # If no structure detected, return empty list so fallback kicks in
        if len(sections) <= 1:
            return []

        # Build chunks from sections, splitting oversized sections
        chunks = []
        chunk_idx = 0
        for heading, body in sections:
            title = heading if heading else f'片段 {chunk_idx + 1}'

            if len(body) <= settings.CHUNK_SIZE:
                chunks.append({
                    'text': body,
                    'title': title,
                })
                chunk_idx += 1
            else:
                # Split oversized section body into sub-chunks
                sub_chunks = self._split_by_fixed_length(body)
                for j, sub in enumerate(sub_chunks):
                    chunks.append({
                        'text': sub['text'],
                        'title': f'{title} ({j + 1})',
                    })
                    chunk_idx += 1

        return chunks

    # ─── Heading-based splitting ───────────────────────────────────

    def _split_by_heading(self, text: str, level: int | None = None) -> list[dict]:
        """
        Split text by markdown-style headings.

        Args:
            level: Specific heading level (1-4). None = all levels (1-4).
        """
        if level is not None:
            # Match only headings of the exact level, e.g. "^# " for level 1
            heading_pattern = re.compile(rf'^{"#" * level}\s+.+$', re.MULTILINE)
        else:
            # Match any heading level 1-4
            heading_pattern = re.compile(r'^#{1,4}\s+.+$', re.MULTILINE)

        sections = heading_pattern.split(text)
        headings = heading_pattern.findall(text)

        if not sections or len(sections) <= 1:
            return []

        chunks = []
        for i, section in enumerate(sections):
            section = section.strip()
            if not section:
                continue
            heading = headings[i - 1].strip() if i > 0 else ""
            title = heading.lstrip("#").strip() if heading else f"Section {i}"

            if len(section) > settings.CHUNK_SIZE:
                sub_chunks = self._split_by_fixed_length(section)
                for j, sub in enumerate(sub_chunks):
                    chunks.append({
                        "text": sub["text"],
                        "title": f"{title} ({j + 1})",
                    })
            else:
                chunks.append({"text": section, "title": title})
        return chunks

    # ─── Paragraph-based splitting ─────────────────────────────────

    def _split_by_paragraph(self, text: str) -> list[dict]:
        """Split text by paragraphs and merge small ones.
        For text without clear paragraph breaks (common in PDFs), falls back to line-based splitting."""
        # First try double-newline (true paragraphs)
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        # If only one huge paragraph (common in PDFs), fall back to line-based splitting
        if len(paragraphs) <= 1:
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            if len(lines) > 1:
                # Merge consecutive lines into paragraph-like chunks
                paragraphs = []
                current = ""
                for line in lines:
                    if current:
                        current += "\n" + line
                    else:
                        current = line
                    # Break when line ends with sentence-ending punctuation
                    if line and line[-1] in '。！？.!?':
                        paragraphs.append(current)
                        current = ""
                if current.strip():
                    paragraphs.append(current)

        if not paragraphs:
            return []

        chunks = []
        current_chunk = ""
        current_len = 0
        chunk_index = 0

        for para in paragraphs:
            para_len = len(para)
            if current_len + para_len > settings.CHUNK_SIZE and current_chunk:
                chunks.append({
                    "text": current_chunk.strip(),
                    "title": f"Paragraph {chunk_index + 1}",
                })
                chunk_index += 1
                current_chunk = para
                current_len = para_len
            else:
                if current_chunk:
                    current_chunk += "\n\n" + para
                else:
                    current_chunk = para
                current_len += para_len

        if current_chunk.strip():
            chunks.append({
                "text": current_chunk.strip(),
                "title": f"Paragraph {chunk_index + 1}",
            })

        return chunks

    # ─── Fixed-length splitting ────────────────────────────────────

    def _split_by_fixed_length(self, text: str) -> list[dict]:
        """Split text by fixed character length with overlap."""
        chunk_size = settings.CHUNK_SIZE
        chunk_overlap = settings.CHUNK_OVERLAP

        if len(text) <= chunk_size:
            return [{"text": text, "title": ""}]

        chunks = []
        start = 0
        chunk_index = 0

        while start < len(text):
            end = start + chunk_size
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    "text": chunk_text,
                    "title": f"Chunk {chunk_index + 1}",
                })
            start = end - chunk_overlap
            chunk_index += 1

        # Safety net: if all slices stripped to empty (e.g. whitespace-only text > CHUNK_SIZE),
        # return at least one chunk with the original stripped text
        if not chunks:
            stripped = text.strip()
            if stripped:
                chunks.append({"text": stripped, "title": ""})

        return chunks

    # ─── Sentence-based splitting ──────────────────────────────────

    def _split_by_sentence(self, text: str) -> list[dict]:
        """
        Split text by sentence delimiters (。！？.!?) and merge
        small sentences into chunks up to CHUNK_SIZE.
        """
        # Split on sentence-ending punctuation while keeping the delimiter
        sentence_pattern = re.compile(r'([^。！？.!?\n]+[。！？.!?]+)')
        sentences = sentence_pattern.findall(text)

        # If no sentence delimiters found, fall back to fixed-length
        if not sentences:
            remaining = text.strip()
            if remaining:
                return self._split_by_fixed_length(remaining)
            return []

        chunks = []
        current_chunk = ""
        current_len = 0
        chunk_index = 0

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            sent_len = len(sentence)
            if current_len + sent_len > settings.CHUNK_SIZE and current_chunk:
                chunks.append({
                    "text": current_chunk.strip(),
                    "title": f"Sentences {chunk_index + 1}",
                })
                chunk_index += 1
                current_chunk = sentence
                current_len = sent_len
            else:
                if current_chunk:
                    current_chunk += sentence
                else:
                    current_chunk = sentence
                current_len += sent_len

        if current_chunk.strip():
            chunks.append({
                "text": current_chunk.strip(),
                "title": f"Sentences {chunk_index + 1}",
            })

        return chunks

    # ─── Token estimation ──────────────────────────────────────────

    def estimate_tokens(self, text: str) -> int:
        """Roughly estimate token count for Chinese + English mixed text."""
        chinese_chars = len(re.findall(r'[一-鿿]', text))
        other_chars = len(text) - chinese_chars
        return chinese_chars + (other_chars // 4)
