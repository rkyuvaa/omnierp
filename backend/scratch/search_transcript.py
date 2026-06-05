import json

transcript_path = r"C:\Users\rkyuv\.gemini\antigravity\brain\e28751fa-fe00-4ece-aebd-ed826e0d6173\.system_generated\logs\transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

search_terms = ["arrear tracker", "arrears tracker", "pending arrears tracker", "inactive"]

results = []
for idx, line in enumerate(lines):
    try:
        data = json.loads(line)
        content = data.get("content", "")
        if not content:
            continue
        
        # Check if any search term is in content (case-insensitive)
        if any(term in content.lower() for term in search_terms):
            results.append((idx, data.get("type"), content))
    except Exception as e:
        pass

output_path = r"C:\Users\rkyuv\OneDrive\Documents\erp\backend\scratch\transcript_search.txt"
with open(output_path, "w", encoding="utf-8") as out:
    for idx, step_type, content in results:
        out.write(f"=== Step {idx} ({step_type}) ===\n{content}\n\n")

print(f"Found {len(results)} matching steps.")
