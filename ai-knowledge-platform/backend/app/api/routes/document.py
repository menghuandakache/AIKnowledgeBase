"""Document import routes."""
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.schemas.document import (
    DocumentUploadResponse, DocumentStatusResponse,
    DocumentImportRequest, DocumentImportResponse,
    DocumentParseAsyncResponse, DocumentParseRequest,
    DocumentListResponse,
    DraftKnowledgeResponse,
)
from app.services.document_service import DocumentService
from app.repositories.document_repo import DocumentRepository
from app.repositories.knowledge_repo import KnowledgeRepository
from app.core.exceptions import NotFoundException, ValidationException
from app.tasks.document_tasks import parse_document_task
from app.services.parser_service import ParserService
from app.services.chunk_service import ChunkService
from app.utils.text_cleaner import clean_pdf_text

router = APIRouter()


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    kb_id: str = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents for a knowledge base."""
    service = DocumentService(db)
    return service.list_by_kb(kb_id=kb_id, page=page, page_size=page_size)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    kb_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Upload a document for parsing."""
    content = await file.read()
    service = DocumentService(db)
    return service.upload(
        kb_id=kb_id,
        filename=file.filename,
        file_content=content,
        created_by=str(current_user.id),
    )


@router.post("/{document_id}/parse", response_model=DocumentParseAsyncResponse)
async def parse_document(
    document_id: str,
    request: DocumentParseRequest = DocumentParseRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Dispatch async document parsing. Falls back to synchronous if Celery is unavailable."""
    doc_repo = DocumentRepository(db)
    knowledge_repo = KnowledgeRepository(db)

    doc = doc_repo.get_by_id(document_id)
    if not doc:
        raise NotFoundException(f"Document {document_id} not found")

    if doc.parse_status not in ("uploaded", "failed"):
        raise ValidationException(
            f"Cannot parse document in status '{doc.parse_status}'"
        )

    # Immediately mark as parsing
    doc_repo.update_parse_status(document_id, "parsing")

    # Try Celery dispatch first, fall back to synchronous parsing
    try:
        task = parse_document_task.delay(
            document_id=document_id,
            user_id=str(current_user.id),
            chunk_method=request.chunk_method,
        )
        return {
            "id": document_id,
            "parse_status": "parsing",
            "message": "Parsing dispatched to background worker",
            "task_id": str(task.id),
        }
    except Exception:
        # Celery not available — run parsing inline
        try:
            parser = ParserService()
            chunk_service = ChunkService()

            text = parser.parse(doc.file_path, doc.file_type)

            # Apply PDF-specific text cleaning
            if doc.file_type == "pdf" and text:
                text = clean_pdf_text(text)

            chunks = chunk_service.split_text(text, method=request.chunk_method)

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
                    created_by=str(current_user.id),
                )
                draft_ids.append(str(knowledge.id))

            doc_repo.update_parse_status(document_id, "parsed")

            return {
                "id": document_id,
                "parse_status": "parsed",
                "message": f"Parsed inline: {len(draft_ids)} drafts created (Celery unavailable)",
                "task_id": None,
            }
        except Exception as parse_error:
            doc_repo.update_parse_status(document_id, "failed", str(parse_error))
            raise ValidationException(f"Parsing failed: {str(parse_error)}")


@router.get("/{document_id}/status", response_model=DocumentStatusResponse)
async def get_document_status(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get document parse status."""
    service = DocumentService(db)
    return service.get_status(document_id)


@router.get("/{document_id}/drafts", response_model=list[DraftKnowledgeResponse])
async def get_document_drafts(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get knowledge drafts generated from a document."""
    knowledge_repo = KnowledgeRepository(db)
    items = knowledge_repo.list_all(page_size=500)
    drafts = [
        {
            "id": str(item.id),
            "title": item.title,
            "content": item.content,
            "chunk_index": 0,
            "category": item.category,
            "tags": item.tags or [],
        }
        for item in items
        if str(getattr(item, 'source_file_id', '')) == document_id and item.status == "draft"
    ]
    return drafts


@router.post("/{document_id}/import", response_model=DocumentImportResponse)
async def import_drafts(
    document_id: str,
    request: DocumentImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Import draft knowledge items into the knowledge base."""
    knowledge_repo = KnowledgeRepository(db)
    doc_repo = DocumentRepository(db)

    imported = 0
    for draft_id in request.draft_ids:
        knowledge = knowledge_repo.get_by_id(draft_id)
        if knowledge and str(getattr(knowledge, 'source_file_id', '')) == document_id:
            knowledge_repo.publish(draft_id)
            imported += 1

    doc_repo.update_parse_status(document_id, "imported")

    return {
        "imported_count": imported,
        "message": f"{imported} knowledge drafts imported successfully",
    }
