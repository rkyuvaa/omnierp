import re

path = r'frontend\src\pages\service\ServiceForm.jsx'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The two new fields to insert
new_fields = '''                 <div className="form-group">
                   <label className="form-label text-xs uppercase fw-800">Vehicle Model</label>
                   <input className="form-input" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} value={form.vehicle_model || ''} readOnly placeholder="—" />
                 </div>

                 <div className="form-group">
                   <label className="form-label text-xs uppercase fw-800">Vehicle Year</label>
                   <input className="form-input" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }} value={form.vehicle_year || ''} readOnly placeholder="—" />
                 </div>

                 '''

# Find the KIT Number label line
kit_label = 'fw-800">KIT Number</label>'

if kit_label in content:
    # Find the start of that form-group div
    idx = content.find(kit_label)
    # Walk back to find the <div className="form-group"> that starts this block
    div_start = content.rfind('<div className="form-group">', 0, idx)
    # Insert our new fields just before this div
    content = content[:div_start] + new_fields + content[div_start:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: Vehicle Model and Vehicle Year fields inserted before KIT Number")
else:
    print(f"ERROR: Could not find anchor '{kit_label}' in file")
    # Print nearby content for debugging
    for i, line in enumerate(content.splitlines()):
        if 'KIT' in line or 'kit' in line.lower():
            print(f"  Line {i+1}: {line}")
