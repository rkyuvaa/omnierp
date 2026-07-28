import json

transcript_path = r"C:\Users\rkyuv\.gemini\antigravity\brain\e28751fa-fe00-4ece-aebd-ed826e0d6173\.system_generated\logs\transcript.jsonl"
output_path = r"C:\Users\rkyuv\OneDrive\Documents\erp\backend\scratch\user_messages.txt"

with open(transcript_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

user_inputs = []
for idx, line in enumerate(lines):
    try:
        data = json.loads(line)
        if data.get("type") == "USER_INPUT":
            user_inputs.append((idx, data.get("content")))
    except Exception as e:
        pass

with open(output_path, "w", encoding="utf-8") as out:
    for idx, content in user_inputs:
        out.write(f"--- Line {idx} ---\n{content}\n\n")

print(f"Extracted {len(user_inputs)} user messages.")
