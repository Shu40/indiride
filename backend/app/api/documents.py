import os
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole, RiderProfile
from app.models.admin import RiderDocument, DocumentType
from app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/rider/documents", tags=["Rider Document & Identity Security"])

# Security constants
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "documents")
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 # 5 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "application/pdf": [b"%PDF"]
}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}


def validate_file_security(file_bytes: bytes, filename: str, content_type: str) -> str:
    """
    Validates file size, file extension, MIME type, and magic bytes.
    Protects against malicious executable uploads disguised as images/documents.
    """
    # 1. Size check
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum allowed size is 5 MB."
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file uploaded."
        )

    # 2. Extension check
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Disallowed file extension '{ext}'. Only JPG, PNG, and PDF documents are permitted."
        )

    # 3. MIME type check
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Disallowed MIME type '{content_type}'."
        )

    # 4. Magic bytes inspection
    expected_signatures = ALLOWED_MIME_TYPES[content_type]
    valid_signature = any(file_bytes.startswith(sig) for sig in expected_signatures)
    if not valid_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content does not match declared MIME type (invalid magic bytes header)."
        )

    return ext


@router.post("/upload")
async def upload_rider_document(
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """
    Secure document upload for Rider onboarding / verification (License, RC, Aadhaar, Insurance):
    - File size limited to 5MB
    - Content-Type and Magic Byte verification
    - Path traversal prevention
    - Strictly authorized to the authenticated rider
    """
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found.")

    file_bytes = await file.read()
    clean_filename = os.path.basename(file.filename or "document")
    ext = validate_file_security(file_bytes, clean_filename, file.content_type)

    # Target directory isolated per rider
    rider_dir = os.path.join(UPLOAD_DIR, profile.id)
    os.makedirs(rider_dir, exist_ok=True)

    # Generate secure random storage filename
    doc_id = str(uuid.uuid4())
    stored_filename = f"{document_type.value}_{doc_id}{ext}"
    stored_path = os.path.join(rider_dir, stored_filename)

    with open(stored_path, "wb") as f:
        f.write(file_bytes)

    # Upsert document record in database
    existing_doc = db.query(RiderDocument).filter(
        RiderDocument.rider_id == profile.id,
        RiderDocument.document_type == document_type
    ).first()

    if existing_doc:
        existing_doc.file_url = stored_path
        existing_doc.is_verified = False
        existing_doc.uploaded_at = datetime.now(timezone.utc)
        doc_record = existing_doc
    else:
        doc_record = RiderDocument(
            id=doc_id,
            rider_id=profile.id,
            document_type=document_type,
            file_url=stored_path,
            is_verified=False
        )
        db.add(doc_record)

    db.commit()
    db.refresh(doc_record)

    return {
        "status": "success",
        "document_id": doc_record.id,
        "document_type": doc_record.document_type.value,
        "is_verified": doc_record.is_verified,
        "message": "Document uploaded securely and queued for admin verification."
    }


@router.get("/list")
@router.get("")
def list_my_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.RIDER))
):
    """Lists all uploaded documents and verification status for the authenticated rider."""
    profile = current_user.rider_profile
    if not profile:
        raise HTTPException(status_code=404, detail="Rider profile not found.")

    docs = db.query(RiderDocument).filter(RiderDocument.rider_id == profile.id).all()
    return [
        {
            "id": d.id,
            "document_type": d.document_type.value,
            "is_verified": d.is_verified,
            "verification_notes": d.verification_notes,
            "uploaded_at": d.uploaded_at
        } for d in docs
    ]


@router.get("/{document_id}")
def get_rider_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves document details and validates ownership:
    - Only the owning Rider or an Administrator can access (403 for other users)
    """
    doc = db.query(RiderDocument).filter(RiderDocument.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    is_admin = current_user.role == UserRole.ADMIN
    is_owner = current_user.rider_profile and current_user.rider_profile.id == doc.rider_id

    if not is_admin and not is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You cannot access identity documents belonging to other riders."
        )

    return {
        "id": doc.id,
        "document_type": doc.document_type.value,
        "is_verified": doc.is_verified,
        "verification_notes": doc.verification_notes,
        "uploaded_at": doc.uploaded_at
    }


