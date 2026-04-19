from xhtml2pdf import pisa
from io import BytesIO
import base64

def render_to_pdf(html_content: str):
    """
    Converts HTML content to a PDF binary stream.
    """
    result = BytesIO()
    pdf = pisa.pisaDocument(BytesIO(html_content.encode("utf-8")), result)
    if not pdf.err:
        return result.getvalue()
    return None

def generate_form_html(submission, definition):
    """
    Generates a clean HTML structure for the PDF based on submission data and template config.
    """
    data = submission.data
    fields = definition.fields_config
    pdf_cfg = definition.pdf_config
    
    # Simple CSS for the A4 look
    css = """
    @page { size: A4; margin: 1.5cm; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.5; }
    .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
    .header table { width: 100%; }
    .logo { height: 60px; }
    .doc-title { text-align: right; }
    .doc-name { font-size: 18pt; font-weight: bold; margin-bottom: 5px; }
    .doc-ref { font-size: 10pt; color: #666; }
    
    .grid { width: 100%; border-collapse: collapse; }
    .field-group { margin-bottom: 15px; }
    .label { font-size: 9pt; font-weight: bold; color: #777; margin-bottom: 2px; text-transform: uppercase; }
    .value { font-size: 11pt; border-bottom: 1px solid #eee; min-height: 20px; padding: 2px 0; }
    
    .table-field { width: 100%; border: 1px solid #ddd; border-collapse: collapse; margin: 10px 0; }
    .table-field th { background: #f5f5f5; border: 1px solid #ddd; padding: 6px; font-size: 10pt; text-align: left; }
    .table-field td { border: 1px solid #ddd; padding: 6px; font-size: 10pt; }
    
    .signature-box { border: 1px dashed #ccc; background: #fafafa; padding: 10px; text-align: center; width: 250px; margin-top: 10px; }
    .signature-img { max-height: 80px; }
    
    .footer { position: fixed; bottom: 0; width: 100%; border-top: 1px solid #eee; padding-top: 10px; font-size: 8pt; color: #999; }
    """
    
    # Build HTML Rows
    rows_html = ""
    current_row = []
    
    for f in fields:
        val = data.get(f['key'], '—')
        
        # Format values
        if f['type'] == 'table':
            table_rows = ""
            for r in (val if isinstance(val, list) else []):
                table_rows += f"<tr><td>{r.get('desc','')}</td><td>{r.get('qty','')}</td><td>{r.get('val','')}</td></tr>"
            
            field_html = f"""
            <div style="width: 100%; margin-top: 20px;">
                <div class="label">{f['label']}</div>
                <table class="table-field">
                    <thead><tr><th>Description</th><th>Qty</th><th>Value</th></tr></thead>
                    <tbody>{table_rows or '<tr><td colspan="3" style="text-align:center">No data</td></tr>'}</tbody>
                </table>
            </div>
            """
            rows_html += field_html
        elif f['type'] == 'signature':
            sig_html = ""
            if val and val.startswith('data:image'):
                 sig_html = f'<img src="{val}" class="signature-img" />'
            else:
                 sig_html = '<div style="color:#ccc; padding: 20px;">No Signature Provided</div>'
                 
            field_html = f"""
            <div style="width: 50%;">
                <div class="label">{f['label']}</div>
                <div class="signature-box">{sig_html}</div>
            </div>
            """
            rows_html += field_html
        elif f['type'] == 'textarea':
             rows_html += f'<div class="field-group" style="width: 100%;"><div class="label">{f["label"]}</div><div class="value" style="border: 1px solid #eee; padding: 10px;">{str(val).replace("\\n","<br>")}</div></div>'
        else:
             width = "48%" if f.get('width') == 'half' else "23%" if f.get('width') == 'quarter' else "100%"
             rows_html += f'<div class="field-group" style="width: {width}; display: inline-block; vertical-align: top; margin-right: 2%;"><div class="label">{f["label"]}</div><div class="value">{val}</div></div>'

    html = f"""
    <html>
    <head><style>{css}</style></head>
    <body>
        <div class="header">
            <table>
                <tr>
                    <td>
                        {f'<img src="{pdf_cfg["logo"]}" class="logo" />' if pdf_cfg.get('logo') else '<div style="font-weight:bold; font-size: 20pt;">OmniERP</div>'}
                        <div style="font-size: 9pt; color: #666; margin-top: 5px;">{pdf_cfg.get('header', '').replace('\\n', '<br>')}</div>
                    </td>
                    <td class="doc-title">
                        <div class="doc-name">{definition.name.upper()}</div>
                        <div class="doc-ref">REF: {submission.reference_number}</div>
                        <div class="doc-ref">DATE: {submission.created_at.strftime("%d-%m-%Y")}</div>
                    </td>
                </tr>
            </table>
        </div>
        
        <div class="content">
            {rows_html}
        </div>
        
        <div class="footer">
            {pdf_cfg.get('footer', 'Generated by OmniERP Dynamic Form Engine')}
        </div>
    </body>
    </html>
    """
    return html
