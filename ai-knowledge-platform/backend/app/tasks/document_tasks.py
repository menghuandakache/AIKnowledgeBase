"""Async document parsing tasks."""
from app.tasks.celery_app import celery_app
from app.core.config import get_settings
from app.core.database import SessionLocal
from app.services.parser_service import ParserService
from app.services.chunk_service import ChunkService
from app.repositories.document_repo import DocumentRepository
from app.repositories.knowledge_repo import KnowledgeRepository
from app.utils.text_cleaner import clean_pdf_text

settings = get_settings()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def parse_document_task(self, document_id: str, user_id: str = None, chunk_method: str = "auto"):
    """Async task to parse a document and create knowledge drafts."""
    db = SessionLocal()
    try:
        doc_repo = DocumentRepository(db)
        knowledge_repo = KnowledgeRepository(db)
        parser = ParserService()
        chunk_service = ChunkService()

        doc = doc_repo.get_by_id(document_id)
        if not doc:
            return {"error": f"Document {document_id} not found"}

        # Update status to parsing
        doc_repo.update_parse_status(document_id, "parsing")

        # Parse document
        text = parser.parse(doc.file_path, doc.file_type)

        # Apply PDF-specific text cleaning
        if doc.file_type == "pdf" and text:
            text = clean_pdf_text(text)

        # Split into chunks using the specified method
        chunks = chunk_service.split_text(text, method=chunk_method)

        # Create knowledge drafts
        draft_ids = []
        for i, chunk in enumerate(chunks):
            title = chunk.get("title", f"片段 {i + 1}")
            knowledge = knowledge_repo.create(
                kb_id=str(doc.kb_id),
                title=f"{doc.filename} - {title}",
                content=chunk["text"],
                status="draft",
                source_type="document",
                source_file_id=str(doc.id),
                created_by=user_id,
            )
            draft_ids.append(str(knowledge.id))

        doc_repo.update_parse_status(document_id, "parsed")
        return {
            "document_id": document_id,
            "status": "parsed",
            "draft_count": len(draft_ids),
        }

    except Exception as e:
        doc_repo.update_parse_status(document_id, "failed", str(e))
        raise self.retry(exc=e)

    finally:
        db.close()
