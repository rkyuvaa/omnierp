from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List
import os
import shutil
import zipfile
import subprocess
from app.auth import get_current_user, require_admin
from backup_manager import list_backups, create_backup, delete_old_backups, BACKUP_DIR, UPLOADS_DIR, get_db_params

router = APIRouter()

@router.get("/backups")
def get_backups(cu=Depends(get_current_user)):
    # Optional: restrict to admins
    if not cu.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can manage backups")
    return list_backups()

@router.post("/backups/generate")
def generate_backup(cu=Depends(get_current_user)):
    if not cu.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can manage backups")
    
    try:
        name, err = create_backup()
        if err:
            raise HTTPException(status_code=500, detail=err)
        
        delete_old_backups()
        return {"message": "Backup created successfully", "filename": name}
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@router.get("/backups/{filename}/download")
def download_backup(filename: str, cu=Depends(get_current_user)):
    if not cu.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can manage backups")
    
    path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Backup file not found")
    
    return FileResponse(path, filename=filename, media_type='application/zip')

@router.post("/backups/restore")
async def restore_backup(file: UploadFile = File(...), cu=Depends(get_current_user)):
    if not cu.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can manage backups")
    
    # Save the uploaded file temporarily
    temp_zip = os.path.join(BACKUP_DIR, "temp_restore.zip")
    with open(temp_zip, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    temp_extract = os.path.join(BACKUP_DIR, "temp_extract")
    if os.path.exists(temp_extract):
        shutil.rmtree(temp_extract)
    os.makedirs(temp_extract)
    
    try:
        # 1. Extract the bundle
        with zipfile.ZipFile(temp_zip, 'r') as zipf:
            zipf.extractall(temp_extract)
        
        # 2. Restore Database
        sql_file = os.path.join(temp_extract, "database.sql")
        if os.path.exists(sql_file):
            db_params = get_db_params()
            if not db_params:
                raise HTTPException(status_code=500, detail="Database config error")
            
            user, password, host, port, dbname = db_params
            os.environ['PGPASSWORD'] = password
            
            # Use psql to restore. Note: This assumes the database exists and user has permissions.
            # We use --clean --if-exists in pg_dump ideally, but if not, we might need to drop and recreate.
            # For simplicity, we'll run the SQL file.
            restore_cmd = [
                "/usr/bin/psql",
                "-h", host,
                "-p", port,
                "-U", user,
                "-d", dbname,
                "-f", sql_file
            ]
            result = subprocess.run(restore_cmd, capture_output=True, text=True)
            if result.returncode != 0:
                print(f"Restore error: {result.stderr}")
                # We continue anyway to try and restore files, but return error later
                db_error = result.stderr
            else:
                db_error = None
        
        # 3. Restore Files
        uploads_zip = os.path.join(temp_extract, "uploads.zip")
        if os.path.exists(uploads_zip):
            # Clear existing uploads
            if os.path.exists(UPLOADS_DIR):
                for item in os.listdir(UPLOADS_DIR):
                    item_path = os.path.join(UPLOADS_DIR, item)
                    if os.path.isfile(item_path): os.remove(item_path)
                    elif os.path.isdir(item_path): shutil.rmtree(item_path)
            else:
                os.makedirs(UPLOADS_DIR)
                
            with zipfile.ZipFile(uploads_zip, 'r') as zipf:
                zipf.extractall(UPLOADS_DIR)
        
        if db_error:
            return {"message": "Files restored, but database restore had errors", "error": db_error}
        
        return {"message": "System restored successfully"}
        
    finally:
        if os.path.exists(temp_zip): os.remove(temp_zip)
        if os.path.exists(temp_extract): shutil.rmtree(temp_extract)
