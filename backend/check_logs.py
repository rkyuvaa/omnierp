import subprocess
import os

output_path = r"c:\Users\rkyuv\OneDrive\Documents\erp\backend\server_logs.txt"

# This script is intended to be run on the AWS server to get logs
# But I will also check if I can find any local clues in models.py
with open(output_path, "w") as f:
    f.write("Checking local models.py integrity...\n")
