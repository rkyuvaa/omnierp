import os
import sys
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import ServiceRequest, SequenceConfig
from sqlalchemy import func

def fix_sequences():
    db = SessionLocal()
    try:
        # Get the highest sequence number from ServiceRequest
        # References look like: SER/2026/0001
        highest_ref = db.query(ServiceRequest.reference).order_by(ServiceRequest.reference.desc()).first()
        if highest_ref and highest_ref[0]:
            ref_str = highest_ref[0]
            try:
                # Extract the number part: SER/2026/0001 -> 1
                num_part = int(ref_str.split('/')[-1])
                
                # Update SequenceConfig
                seq = db.query(SequenceConfig).filter(SequenceConfig.module == "service").first()
                if not seq:
                    seq = SequenceConfig(module="service", prefix="SER", padding=4, current_number=num_part)
                    db.add(seq)
                else:
                    if num_part > seq.current_number:
                        seq.current_number = num_part
                db.commit()
                print(f"Successfully updated 'service' sequence to {seq.current_number}")
            except Exception as e:
                print(f"Could not parse reference {ref_str}: {e}")
        else:
            print("No service requests found.")
    finally:
        db.close()

if __name__ == "__main__":
    fix_sequences()
