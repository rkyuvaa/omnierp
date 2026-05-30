from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List
import os
import shutil
import zipfile
import subprocess
from app.auth import get_current_user, require_admin
from backup_manager import list_backups, create_backup, delete_old_backups, BACKUP_DIR, UPLOADS_DIR, get_db_params, find_pg_tool

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

def run_restore_in_background(temp_zip: str, temp_extract: str):
    print(f"[BackgroundRestore] Starting recovery job...")
    try:
        # 1. Extract the bundle
        with zipfile.ZipFile(temp_zip, 'r') as zipf:
            zipf.extractall(temp_extract)
        print(f"[BackgroundRestore] Bundle extracted successfully.")
        
        # 2. Restore Database
        sql_file = os.path.join(temp_extract, "database.sql")
        db_error = None
        if os.path.exists(sql_file):
            db_params = get_db_params()
            if db_params:
                user, password, host, port, dbname = db_params
                os.environ['PGPASSWORD'] = password
                
                tool_path = find_pg_tool("psql")
                restore_cmd = [
                    tool_path,
                    "-h", str(host),
                    "-p", str(port) if port else "5432",
                    "-U", str(user),
                    "-d", str(dbname),
                    "-f", sql_file
                ]
                
                # Dispose engine pool to close open database connections cleanly
                try:
                    from app.database import engine
                    engine.dispose()
                    print(f"[BackgroundRestore] Disposed SQLAlchemy connection pool.")
                except Exception as de:
                    print(f"[BackgroundRestore] Error disposing engine pool: {de}")
                
                print(f"[BackgroundRestore] Executing psql restore process...")
                result = subprocess.run(restore_cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    print(f"[BackgroundRestore] psql error output: {result.stderr}")
                else:
                    print(f"[BackgroundRestore] Database restore completed successfully.")
            else:
                print(f"[BackgroundRestore] Database configuration details could not be parsed.")
        
        # 3. Restore Files
        uploads_zip = os.path.join(temp_extract, "uploads.zip")
        if os.path.exists(uploads_zip):
            # Clear existing uploads safely
            if os.path.exists(UPLOADS_DIR):
                for item in os.listdir(UPLOADS_DIR):
                    item_path = os.path.join(UPLOADS_DIR, item)
                    try:
                        if os.path.isfile(item_path): 
                            os.remove(item_path)
                        elif os.path.isdir(item_path): 
                            shutil.rmtree(item_path)
                    except Exception as fe:
                        print(f"[BackgroundRestore] Could not remove {item_path} (continuing...): {fe}")
            else:
                os.makedirs(UPLOADS_DIR, exist_ok=True)
                
            with zipfile.ZipFile(uploads_zip, 'r') as zipf:
                zipf.extractall(UPLOADS_DIR)
            print(f"[BackgroundRestore] Uploaded static files restored successfully.")
        
        # 4. Restore .env
        env_backup_path = os.path.join(temp_extract, ".env")
        if os.path.exists(env_backup_path):
            target_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
            try:
                shutil.copy(env_backup_path, target_env)
                print(f"[BackgroundRestore] .env environment variables restored.")
            except Exception as ee:
                print(f"[BackgroundRestore] Could not copy .env file: {ee}")
                
        print(f"[BackgroundRestore] System recovery completed successfully.")
        
    except Exception as e:
        import traceback
        print(f"[BackgroundRestore] CRITICAL RECOVERY FAILURE:\n{traceback.format_exc()}")
    finally:
        try:
            if os.path.exists(temp_zip): os.remove(temp_zip)
        except Exception: pass
        try:
            if os.path.exists(temp_extract): shutil.rmtree(temp_extract)
        except Exception: pass
        print(f"[BackgroundRestore] Background cleanup done.")

@router.post("/backups/restore")
async def restore_backup(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    cu=Depends(get_current_user)
):
    if not cu.is_superadmin:
        raise HTTPException(status_code=403, detail="Only superadmins can manage backups")
    
    # Ensure backup directory exists
    from backup_manager import ensure_backup_dir
    ensure_backup_dir()

    temp_zip = os.path.join(BACKUP_DIR, "temp_restore.zip")
    temp_extract = os.path.join(BACKUP_DIR, "temp_extract")
    
    try:
        # Save the uploaded file temporarily (sync, extremely fast)
        with open(temp_zip, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Spawn the restore execution in the background
        background_tasks.add_task(run_restore_in_background, temp_zip, temp_extract)
        
        return {"message": "Restore started successfully in the background. Systems and files are being recovered."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate restore: {str(e)}")
