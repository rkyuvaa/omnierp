import requests
import time
import sys
from datetime import datetime
try:
    from zk import ZK, const
except ImportError:
    print("Error: pyzk library not found. Install it with: pip install pyzk")
    sys.exit(1)

# CONFIGURATION
# ---------------------------------------------------------
ERP_URL = "https://kimerp.ddns.net/api/hr/attendance/sync/bulk" # Your AWS ERP URL
MACHINE_IP = "192.168.31.4"
MACHINE_PORT = 4370
MACHINE_ID = 1  # The ID of this machine in your ERP (usually 1 if it's the first)
# ---------------------------------------------------------

def sync():
    print(f"[{datetime.now()}] Connecting to biometric machine at {MACHINE_IP}...")
    zk = ZK(MACHINE_IP, port=MACHINE_PORT, timeout=10)
    conn = None
    try:
        conn = zk.connect()
        print("Connected! Disabling device for sync...")
        conn.disable_device()
        
        print("Fetching attendance logs...")
        attendance = conn.get_attendance()
        print(f"Found {len(attendance)} logs on device.")
        
        punches = []
        for log in attendance:
            punches.append({
                "biometric_id": str(log.user_id),
                "punch_time": log.timestamp.strftime("%Y-%m-%dT%H:%M:%S"),
                "raw_uid": str(log.uid)
            })
            
        if not punches:
            print("No new punches found.")
        else:
            print(f"Uploading {len(punches)} logs to ERP Cloud...")
            payload = {
                "machine_id": MACHINE_ID,
                "punches": punches
            }
            response = requests.post(ERP_URL, json=payload, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"Success! Imported: {result['imported']}, Skipped: {result['skipped']}")
            else:
                print(f"Failed to upload. Status: {response.status_code}, Response: {response.text}")
                
        print("Enabling device...")
        conn.enable_device()
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
    finally:
        if conn:
            conn.disconnect()
            print("Disconnected.")

if __name__ == "__main__":
    sync()
    print("\nSync completed. You can close this window.")
    # time.sleep(5) # Keeps window open for 5 seconds
