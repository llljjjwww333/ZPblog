
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from app.api.auth.dependencies import get_current_user
from app.model.user import User
import shutil
import os
import uuid
from typing import List

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = "static/images/uploads"

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/image", summary="Upload an image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image"
        )
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    if not file_ext:
        # Default extension if missing
        if file.content_type == "image/jpeg":
            file_ext = ".jpg"
        elif file.content_type == "image/png":
            file_ext = ".png"
        elif file.content_type == "image/gif":
            file_ext = ".gif"
        else:
            file_ext = ".jpg" # Fallback
            
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {str(e)}"
        )
    
    # Return the URL
    # Assuming static files are served at /static
    url = f"/static/images/uploads/{filename}"
    return {"url": url, "filename": filename}
