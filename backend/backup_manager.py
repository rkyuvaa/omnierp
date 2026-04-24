import os
import subprocess
import datetime
import shutil
import zipfile
from app.config import settings

BACKUP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backups")
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads")

def ensure_backup_dir():
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)

from sqlalchemy.engine import make_url

def get_db_params():
    try:
        url = make_url(settings.DATABASE_URL)
        return url.username, url.password, url.host, url.port, url.database
    except Exception as e:
        print(f"Error parsing DATABASE_URL: {e}")
        return None

def create_backup():
    ensure_backup_dir()
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_dir = os.path.join(BACKUP_DIR, f"temp_{timestamp}")
    os.makedirs(temp_dir)
    
    try:
        # 1. Dump Database
        db_params = get_db_params()
        if not db_params:
            return None, "Failed to parse database configuration"
        
        user, password, host, port, dbname = db_params
        port = str(port) if port else "5432"
        sql_file = os.path.join(temp_dir, "database.sql")
        
        # Set environment variable for password to avoid interactive prompt
        os.environ['PGPASSWORD'] = password
        
        dump_cmd = [
            "pg_dump",
            "-h", str(host),
            "-p", port,
            "-U", str(user),
            "-f", sql_file,
            str(dbname)
        ]
        
        result = subprocess.run(dump_cmd, capture_output=True, text=True)
        if result.returncode != 0:
            error_msg = result.stderr if result.stderr else "Unknown error"
            print(f"pg_dump error: {error_msg}")
            return None, f"Database backup failed: {error_msg}"
        
        # 2. Archive Uploads
        uploads_zip = os.path.join(temp_dir, "uploads.zip")
        if os.path.exists(UPLOADS_DIR):
            with zipfile.ZipFile(uploads_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(UPLOADS_DIR):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, UPLOADS_DIR)
                        zipf.write(file_path, arcname)
        
        # 3. Create Final Bundle
        bundle_name = f"omnierp_snapshot_{timestamp}.zip"
        bundle_path = os.path.join(BACKUP_DIR, bundle_name)
        
        with zipfile.ZipFile(bundle_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            zipf.write(sql_file, "database.sql")
            if os.path.exists(uploads_zip):
                zipf.write(uploads_zip, "uploads.zip")
        
        return bundle_name, None
        
    finally:
        # Cleanup temp files
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

def list_backups():
    ensure_backup_dir()
    files = [f for f in os.listdir(BACKUP_DIR) if f.startswith("omnierp_snapshot_") and f.endswith(".zip")]
    backups = []
    for f in files:
        path = os.path.join(BACKUP_DIR, f)
        stat = os.stat(path)
        backups.append({
            "filename": f,
            "size": stat.st_size,
            "created_at": datetime.datetime.fromtimestamp(stat.st_ctime).isoformat()
        })
    return sorted(backups, key=lambda x: x['created_at'], reverse=True)

def delete_old_backups(keep=7):
    backups = list_backups()
    if len(backups) > keep:
        for b in backups[keep:]:
            path = os.path.join(BACKUP_DIR, b['filename'])
            if os.path.exists(path):
                os.remove(path)

if __name__ == "__main__":
    name, err = create_backup()
    if err:
        print(f"Error: {err}")
    else:
        print(f"Backup created: {name}")
        delete_old_backups()
