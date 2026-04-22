"""
Revert script: restores ServiceForm.jsx to stable 3-column state.
Run from ~/erp/ on the server:  python3 revert_serviceform.py
"""
import re

path = 'frontend/src/pages/service/ServiceForm.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Revert selectVehicle — replace the entire function
old_fn = re.search(
    r'  const selectVehicle = async \(v\) => \{.*?  \};',
    content, re.DOTALL
)

new_fn = '''  const selectVehicle = async (v) => {
    const cd = v.custom_data || {};
    const find = (keys) => {
      for (let k of keys) {
        if (cd[k]) return cd[k];
        const found = Object.keys(cd).find(x => {
           const normalizedX = x.toLowerCase().replace(/[^a-z0-9]/g, '');
           const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
           return normalizedX === normalizedK || normalizedX.includes(normalizedK) || normalizedK.includes(normalizedX);
        });
        if (found) return cd[found];
      }
      return '';
    };

    const vNum = v.vehicle_number || v.name || '';
    const vModel = v.model || v.vehicle_model || v.title || '';
    const vYear = v.year || v.vehicle_year || find(['year', 'vehicle_year', 'model_year', 'mfg_year']) || '';
    const cName = v.customer_name || find(['customer_name', 'name', 'client']) || '';
    const cPhone = v.phone || find(['phone', 'mobile', 'contact']) || '';
    const vInv = v.invoice_number || find(['invoice', 'bill']) || '';

    setForm(f => ({
      ...f,
      product_id: v.id,
      product_serial: v.serial_number || '',
      vehicle_number: vNum,
      vehicle_model: vModel,
      vehicle_year: vYear,
      customer_name: cName || f.customer_name,
      phone: cPhone || f.phone,
      invoice_number: vInv || f.invoice_number,
      linked_product: v
    }));
    setVehicleSearch('');
    setShowResults(false);
  };'''

if old_fn:
    content = content[:old_fn.start()] + new_fn + content[old_fn.end():]
    print("OK: selectVehicle reverted")
else:
    print("WARN: selectVehicle pattern not found")

# 2. Revert grid columns: repeat(5, 1fr) gap 16 -> repeat(3, 1fr) gap 20
content = content.replace(
    "gridTemplateColumns: 'repeat(5, 1fr)', gap: 16",
    "gridTemplateColumns: 'repeat(3, 1fr)', gap: 20"
)
print("OK: grid columns reverted to 3")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("DONE: ServiceForm.jsx reverted successfully")
