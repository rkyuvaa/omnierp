import json

transcript_path = r"C:\Users\rkyuv\.gemini\antigravity\brain\e28751fa-fe00-4ece-aebd-ed826e0d6173\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    try:
        data = json.loads(line)
        if data.get("type") == "USER_INPUT":
            content = data.get("content", "")
            if "arrear" in content.lower():
                print(f"=== Step {idx} ===")
                print(content)
                print("="*40)
    except Exception as e:
        pass
