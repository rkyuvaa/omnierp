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
        val = data.get(f.get('key', ''), '—')
        ftype = f.get('type', 'text')
        
        # Format values
        if ftype == 'separator':
            rows_html += f'<hr style="border:none; border-top:2px solid #ccc; margin: 20px 0; width: 100%;" />'
        elif ftype == 'heading':
            rows_html += f'<div style="width: 100%; font-size: 14pt; font-weight: bold; color: #1a3c5e; margin: 25px 0 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px; text-transform: uppercase;">{f.get("label", "HEADING")}</div>'
        elif ftype == 'static_text':
            content = f.get('content', '').replace('\n', '<br>')
            rows_html += f'<div style="width: 100%; font-size: 10pt; color: #444; margin-bottom: 15px; line-height: 1.6;">{content}</div>'
        elif ftype == 'static_image':
            img_url = f.get('url', '')
            if img_url:
                rows_html += f'<div style="width: 100%; margin: 15px 0; text-align: center;"><img src="{img_url}" style="max-width: 100%; max-height: 250px;" /></div>'
        elif ftype == 'table':
            table_rows = ""
            for r in (val if isinstance(val, list) else []):
                table_rows += f"<tr><td>{r.get('desc','')}</td><td>{r.get('qty','')}</td><td>{r.get('val','')}</td></tr>"
            
            field_html = f"""
            <div style="width: 100%; margin-top: 20px;">
                <div class="label">{f.get('label', '')}</div>
                <table class="table-field">
                    <thead><tr><th>Description</th><th>Qty</th><th>Value</th></tr></thead>
                    <tbody>{table_rows or '<tr><td colspan="3" style="text-align:center">No data</td></tr>'}</tbody>
                </table>
            </div>
            """
            rows_html += field_html
        elif ftype == 'signature':
            sig_html = ""
            if val and isinstance(val, str) and val.startswith('data:image'):
                 sig_html = f'<img src="{val}" class="signature-img" />'
            else:
                 sig_html = '<div style="color:#ccc; padding: 20px;">No Signature Provided</div>'
                 
            field_html = f"""
            <div style="width: 50%; display: inline-block; margin-top: 20px;">
                <div class="label">{f.get('label', '')}</div>
                <div class="signature-box">{sig_html}</div>
            </div>
            """
            rows_html += field_html
        elif ftype == 'textarea':
             formatted_val = str(val).replace("\n", "<br>")
             rows_html += f'<div class="field-group" style="width: 100%;"><div class="label">{f.get("label", "")}</div><div class="value" style="border: 1px solid #eee; padding: 10px; background: #fafafa;">{formatted_val}</div></div>'
        else:
             width = "48%" if f.get('width') == 'half' else "23%" if f.get('width') == 'quarter' else "100%"
             rows_html += f'<div class="field-group" style="width: {width}; display: inline-block; vertical-align: top; margin-right: 2%;"><div class="label">{f.get("label", "")}</div><div class="value">{val}</div></div>'

    header_text = pdf_cfg.get('header', '').replace('\n', '<br>')
    html = f"""
    <html>
    <head><style>{css}</style></head>
    <body>
        <div class="header">
            <table>
                <tr>
                    <td>
                        {f'<img src="{pdf_cfg["logo"]}" class="logo" />' if pdf_cfg.get('logo') else '<div style="font-weight:bold; font-size: 20pt;">OmniERP</div>'}
                        <div style="font-size: 9pt; color: #666; margin-top: 5px;">{header_text}</div>
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


# ─────────────────────────────────────────────
# PAYSLIP PDF GENERATOR
# ─────────────────────────────────────────────

ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen']
TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

def _num_to_words_below_1000(n: int) -> str:
    if n == 0: return ''
    elif n < 20: return ONES[n]
    elif n < 100: return TENS[n // 10] + ((' ' + ONES[n % 10]) if n % 10 else '')
    else: return ONES[n // 100] + ' Hundred' + ((' ' + _num_to_words_below_1000(n % 100)) if n % 100 else '')

def num_to_words(n: float) -> str:
    """Convert a number to Indian words (e.g. 1,23,456 → One Lakh Twenty Three Thousand Four Hundred Fifty Six)"""
    n = int(round(n))
    if n == 0: return 'Zero'
    parts = []
    crore = n // 10_000_000; n %= 10_000_000
    lakh  = n // 100_000;    n %= 100_000
    thou  = n // 1000;       n %= 1000
    rest  = n
    if crore: parts.append(_num_to_words_below_1000(crore) + ' Crore')
    if lakh:  parts.append(_num_to_words_below_1000(lakh)  + ' Lakh')
    if thou:  parts.append(_num_to_words_below_1000(thou)  + ' Thousand')
    if rest:  parts.append(_num_to_words_below_1000(rest))
    return ' '.join(parts)


def generate_payslip_html(record, employee, month_name: str, year: int, pdf_cfg: dict, fields_config: list = None) -> str:
    """
    Generate a professional Indian-format payslip HTML.
    If fields_config is provided and not empty, it builds the PDF dynamically based on the Studio layout.
    Otherwise, it falls back to the standard hardcoded layout.
    """
    company_name    = pdf_cfg.get('company_name', pdf_cfg.get('header', 'KiM ERP').split('\n')[0])
    company_address = pdf_cfg.get('header', '').replace('\n', '<br>')
    company_logo    = pdf_cfg.get('logo', '')
    footer_text     = pdf_cfg.get('footer', 'This is a computer-generated payslip. No signature required.')

    breakdown       = record.components_breakdown or {}
    earnings        = breakdown.get('earnings', {})
    deductions      = breakdown.get('deductions', {})
    total_earnings  = float(record.total_earnings or 0)
    total_deductions= float(record.total_deductions or 0)
    net_salary      = float(record.net_salary or 0)
    net_words       = num_to_words(net_salary) + ' Rupees Only'

    emp_name        = employee.name or '—'
    emp_code        = employee.employee_id or '—'
    designation     = employee.designation or '—'
    department      = employee.department.name if employee.department else '—'
    doj             = employee.date_of_joining.strftime('%d/%m/%Y') if employee.date_of_joining else '—'
    working_days    = int(record.working_days or 0)
    present_days    = record.present_days or 0
    lop_days        = float(record.lop_days or 0)
    on_duty_days    = float(record.on_duty_days or 0)

    logo_html = f'<img src="{company_logo}" style="height:55px; max-width:180px;" />' if company_logo else f'<div style="font-size:20pt; font-weight:900; color:#1a3c5e;">{company_name}</div>'

    # Build standard earnings/deductions rows for both custom and default rendering
    earn_rows = ''
    for name, amt in earnings.items():
        earn_rows += f'<tr><td style="padding:5px 8px; border-bottom:1px solid #f0f0f0;">{name}</td><td style="padding:5px 8px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:600;">&#8377;{amt:,.2f}</td></tr>'
    
    ded_rows = ''
    for name, amt in deductions.items():
        ded_rows += f'<tr><td style="padding:5px 8px; border-bottom:1px solid #f0f0f0;">{name}</td><td style="padding:5px 8px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:600; color:#c0392b;">&#8377;{amt:,.2f}</td></tr>'

    css = """
  @page { size: A4; margin: 1.2cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #222; }
  .payslip { width: 100%; }

  /* Header */
  .hdr { display: table; width: 100%; border-bottom: 3px solid #1a3c5e; padding-bottom: 10px; margin-bottom: 12px; }
  .hdr-left { display: table-cell; vertical-align: middle; width: 60%; }
  .hdr-right { display: table-cell; vertical-align: middle; text-align: right; width: 40%; }
  .slip-title { font-size: 16pt; font-weight: 900; color: #1a3c5e; letter-spacing: 1px; }
  .slip-month { font-size: 10pt; color: #555; margin-top: 3px; }
  .company-addr { font-size: 8.5pt; color: #666; margin-top: 4px; line-height: 1.4; }

  /* Employee Info */
  .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; background: #f7f9fc; border: 1px solid #dde3ea; border-radius: 4px; }
  .info-table td { padding: 5px 10px; font-size: 9pt; border-bottom: 1px solid #eaecef; }
  .info-table td:first-child { font-weight: 700; color: #555; width: 22%; }
  .info-table td:nth-child(3) { font-weight: 700; color: #555; width: 22%; }

  /* Attendance strip */
  .att-strip { display: table; width: 100%; background: #1a3c5e; color: #fff; border-radius: 4px; margin-bottom: 12px; }
  .att-cell { display: table-cell; text-align: center; padding: 7px 5px; font-size: 9pt; border-right: 1px solid rgba(255,255,255,0.15); }
  .att-cell:last-child { border-right: none; }
  .att-num { font-size: 13pt; font-weight: 900; display: block; }
  .att-lbl { font-size: 7.5pt; opacity: 0.8; display: block; }

  /* Earnings / Deductions table */
  .comp-wrap { display: table; width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .comp-col { display: table-cell; width: 50%; vertical-align: top; }
  .comp-col:first-child { padding-right: 6px; }
  .comp-col:last-child  { padding-left: 6px; }
  .comp-hdr { background: #1a3c5e; color: #fff; padding: 6px 8px; font-size: 9.5pt; font-weight: 700; letter-spacing: 0.5px; }
  .comp-tbl { width: 100%; border-collapse: collapse; border: 1px solid #dde3ea; font-size: 9pt; }
  .comp-tbl .total-row td { background: #eef2f7; font-weight: 800; font-size: 9.5pt; border-top: 2px solid #1a3c5e; padding: 6px 8px; }
  .comp-tbl .total-row td:last-child { text-align: right; }

  /* Net salary box */
  .net-box { background: #1a3c5e; color: #fff; padding: 10px 14px; border-radius: 4px; display: table; width: 100%; margin-bottom: 10px; }
  .net-left { display: table-cell; vertical-align: middle; font-size: 12pt; font-weight: 700; }
  .net-right { display: table-cell; text-align: right; vertical-align: middle; font-size: 14pt; font-weight: 900; }
  .net-words { font-size: 8pt; opacity: 0.85; display: block; margin-top: 2px; font-weight: 400; font-style: italic; }

  /* Footer */
  .slip-footer { border-top: 1px solid #dde3ea; padding-top: 7px; font-size: 8pt; color: #888; text-align: center; margin-top: 4px; }
    """

    # ─────────────────────────────────────────────────────────
    # DYNAMIC RENDERER (If user designed a custom layout)
    # ─────────────────────────────────────────────────────────
    if fields_config and len(fields_config) > 0:
        content_html = "<table style='width: 100%; border-collapse: collapse;'><tr>"
        col_count = 0
        
        for f in fields_config:
            ftype = f.get('type')
            width_type = f.get('width', 'full')
            
            if width_type == 'full':
                if col_count == 1:
                    content_html += "<td style='width: 50%;'></td></tr><tr>"
                else:
                    content_html += "</tr><tr>"
                content_html += "<td colspan='2' style='width: 100%; padding-bottom: 15px;'>"
                col_count = 0
            else: # half
                if col_count == 0:
                    content_html += "</tr><tr>"
                content_html += "<td style='width: 50%; padding-right: 2%; padding-bottom: 15px; vertical-align: top;'>"
                col_count += 1
                
            block_label = f.get('label', '').upper()
            
            # Basic Layout Elements
            if ftype == 'separator':
                content_html += f'<hr style="border:none; border-top:2px solid #ccc; margin: 10px 0; width: 100%;" />'
            elif ftype == 'heading':
                content_html += f'<div style="font-size: 14pt; font-weight: bold; color: #1a3c5e; margin: 10px 0; border-bottom: 1px solid #eee; padding-bottom: 5px;">{block_label}</div>'
            elif ftype == 'static_text':
                content = f.get('content', '').replace('\n', '<br>')
                content_html += f'<div style="font-size: 10pt; color: #444; line-height: 1.6;">{content}</div>'
            elif ftype == 'static_image':
                img_url = f.get('url', '')
                if img_url: content_html += f'<div style="text-align: center;"><img src="{img_url}" style="max-width: 100%; max-height: 250px;" /></div>'
            
            # Payroll-Specific Blocks
            elif ftype == 'pr_emp_info':
                content_html += f"""
                  <div style="font-weight:bold; color:#1a3c5e; margin-bottom:5px;">{block_label}</div>
                  <table class="info-table">
                    <tr><td>Employee Name</td><td><strong>{emp_name}</strong></td><td>Employee Code</td><td>{emp_code}</td></tr>
                    <tr><td>Designation</td><td>{designation}</td><td>Department</td><td>{department}</td></tr>
                    <tr><td>Date of Joining</td><td>{doj}</td><td>Salary (CTC)</td><td>&#8377;{float(employee.basic_salary or 0):,.2f}</td></tr>
                  </table>"""
            
            elif ftype == 'pr_attendance':
                content_html += f"""
                  <div style="font-weight:bold; color:#1a3c5e; margin-bottom:5px;">{block_label}</div>
                  <div class="att-strip">
                    <div class="att-cell"><span class="att-num">{working_days}</span><span class="att-lbl">Working Days</span></div>
                    <div class="att-cell"><span class="att-num">{present_days:.1f}</span><span class="att-lbl">Present Days</span></div>
                    <div class="att-cell"><span class="att-num">{float(record.absent_days or 0):.1f}</span><span class="att-lbl">Absent Days</span></div>
                    <div class="att-cell"><span class="att-num">{float(record.leave_days or 0):.1f}</span><span class="att-lbl">Leave Days</span></div>
                    <div class="att-cell"><span class="att-num">{lop_days:.1f}</span><span class="att-lbl">LOP Days</span></div>
                    <div class="att-cell"><span class="att-num">{on_duty_days:.1f}</span><span class="att-lbl">On Duty Days</span></div>
                  </div>"""
            
            elif ftype == 'pr_earnings':
                content_html += f"""
                  <div class="comp-hdr">{block_label}</div>
                  <table class="comp-tbl">{earn_rows}<tr class="total-row"><td>Gross Earnings</td><td>&#8377;{total_earnings:,.2f}</td></tr></table>"""
                
            elif ftype == 'pr_deductions':
                content_html += f"""
                  <div class="comp-hdr" style="background:#c0392b;">{block_label}</div>
                  <table class="comp-tbl">{ded_rows}<tr class="total-row"><td>Total Deductions</td><td style="color:#c0392b;">&#8377;{total_deductions:,.2f}</td></tr></table>"""
                
            elif ftype == 'pr_net_salary':
                content_html += f"""
                  <div class="net-box">
                    <div class="net-left">{block_label}<span class="net-words">{net_words}</span></div>
                    <div class="net-right">&#8377;{net_salary:,.2f}</div>
                  </div>"""
                
            elif ftype == 'pr_custom_comp':
                comp_name = f.get('content', '')
                comp_val = earnings.get(comp_name) or deductions.get(comp_name) or 0
                content_html += f"""
                  <table style="width:100%; border-collapse: collapse; margin-bottom: 5px;">
                    <tr>
                      <td style="padding: 5px; border-bottom: 1px solid #eee; font-size: 9.5pt; color: #333;"><strong>{block_label}</strong></td>
                      <td style="padding: 5px; border-bottom: 1px solid #eee; text-align: right; font-size: 10pt; font-weight: 700;">&#8377;{float(comp_val):,.2f}</td>
                    </tr>
                  </table>"""

            content_html += "</td>"
            if col_count == 2:
                col_count = 0
                
        if col_count == 1:
            content_html += "<td style='width: 50%;'></td>"
        content_html += "</tr></table>"

        return f"""<!DOCTYPE html><html><head><meta charset="utf-8"/><style>{css}</style></head>
        <body><div class="payslip">
          <div class="hdr">
            <div class="hdr-left">{logo_html}<div class="company-addr">{company_address}</div></div>
            <div class="hdr-right"><div class="slip-title">SALARY SLIP</div><div class="slip-month">{month_name} {year}</div></div>
          </div>
          {content_html}
          <div class="slip-footer">{footer_text}</div>
        </div></body></html>"""

    # ─────────────────────────────────────────────────────────
    # DEFAULT RENDERER (Classic Konwert India Motors Format)
    # ─────────────────────────────────────────────────────────
    from datetime import datetime
    now_str = datetime.now().strftime('%d-%b-%Y %I:%M %p')

    earn_items = list(earnings.items())
    ded_items = list(deductions.items())
    max_len = max(len(earn_items), len(ded_items))
    
    earn_ded_rows = ""
    for i in range(max_len):
        e_name, e_amt = earn_items[i] if i < len(earn_items) else ("", None)
        d_name, d_amt = ded_items[i] if i < len(ded_items) else ("", None)
        
        e_amt_str = f"Rs. {float(e_amt):,.2f}" if e_amt is not None else ""
        d_amt_str = f"Rs. {float(d_amt):,.2f}" if d_amt is not None else ""
        
        earn_ded_rows += f"""<tr>
            <td>{e_name}</td><td class="amt">{e_amt_str}</td>
            <td>{d_name}</td><td class="amt">{d_amt_str}</td>
        </tr>"""

    # If logo exists, use it left-aligned, else fallback to text
    logo_block = f'<img src="{company_logo}" style="max-height:70px;" />' if company_logo else ''

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 1.2cm; }}
  * {{ box-sizing: border-box; font-family: Arial, sans-serif; font-size: 9pt; }}
  body {{ color: #333; }}
  .center {{ text-align: center; }}
  
  /* Header styling */
  .company-name {{ font-size: 16pt; font-weight: bold; color: #104c8f; margin-bottom: 4px; }}
  .company-address {{ font-size: 9pt; color: #666; line-height: 1.4; }}
  
  /* Salary Slip Bar */
  .title-bar {{ background-color: #1a68b2; color: #fff; padding: 8px 12px; font-size: 11pt; font-weight: bold; margin-bottom: 10px; }}
  
  /* Month/Year */
  .month-text {{ text-align: right; font-weight: bold; color: #555; margin-bottom: 10px; font-size: 9.5pt; }}
  
  /* Generic Table borders */
  table {{ width: 100%; border-collapse: collapse; margin-bottom: 15px; }}
  td, th {{ border: 1px solid #c9d9e8; padding: 6px 8px; }}
  
  /* Header Table */
  .header-table {{ border: none; margin-bottom: 10px; }}
  .header-table td {{ border: none; padding: 0; vertical-align: middle; }}
  
  /* Employee Info Table */
  .emp-table td.lbl {{ background-color: #f4f7f9; font-weight: bold; color: #444; width: 20%; }}
  .emp-table td.val {{ width: 30%; }}
  
  /* Earnings / Deductions Header */
  .comp-th {{ background-color: #0d4782; color: #fff; font-weight: bold; padding: 8px; border: 1px solid #0d4782; }}
  .sub-th {{ font-weight: bold; color: #555; background: #fff; border-bottom: 1px solid #c9d9e8; }}
  .sub-th.right {{ text-align: right; }}
  
  .amt {{ text-align: right; font-weight: bold; }}
  .net-sal-lbl {{ color: #104c8f; font-weight: bold; }}
  .summary-bg {{ background-color: #f4f7f9; font-weight: bold; }}
  
  .grand-total {{ background-color: #3b8235; color: #fff; font-weight: bold; font-size: 11pt; padding: 10px 12px; border: none; }}
  .grand-total-val {{ text-align: right; font-size: 12pt; border: none; }}
  
  .footer {{ text-align: center; color: #777; font-size: 8pt; margin-top: 30px; line-height: 1.4; border-top: 1px solid #eee; padding-top: 10px; }}
</style>
</head>
<body>

<table class="header-table">
  <tr>
    <td style="width: 25%; text-align: left;">
      {logo_block}
    </td>
    <td style="width: 75%; text-align: center;">
      <div class="company-name">{company_name}</div>
      <div class="company-address">{company_address}</div>
    </td>
  </tr>
</table>

<div class="title-bar">SALARY SLIP — {month_name.upper()} {year}</div>
<div class="month-text">{month_name} {year}</div>

<table class="emp-table">
  <tr>
    <td class="lbl">Employee name</td><td class="val">{emp_name}</td>
    <td class="lbl">Present</td><td class="val">{present_days}</td>
  </tr>
  <tr>
    <td class="lbl">Employee code</td><td class="val">{emp_code}</td>
    <td class="lbl">Absent / LOP</td><td class="val">{lop_days}</td>
  </tr>
  <tr>
    <td class="lbl">Designation</td><td class="val">{designation}</td>
    <td class="lbl">Leave</td><td class="val">{float(record.leave_days or 0):.1f}</td>
  </tr>
  <tr>
    <td class="lbl">Date of Joining</td><td class="val">{doj}</td>
    <td class="lbl"></td><td class="val"></td>
  </tr>
</table>

<table>
  <tr>
    <td colspan="2" class="comp-th" style="width:50%;">Earnings</td>
    <td colspan="2" class="comp-th" style="width:50%;">Deductions</td>
  </tr>
  <tr>
    <td class="sub-th" style="width:30%;">Particulars</td>
    <td class="sub-th right" style="width:20%;">Amt (Rs.ps)</td>
    <td class="sub-th" style="width:30%;">Particulars</td>
    <td class="sub-th right" style="width:20%;">Amt (Rs.ps)</td>
  </tr>
  {earn_ded_rows}
  
  <tr>
    <td class="net-sal-lbl">Gross Earnings</td>
    <td class="amt">Rs. {total_earnings:,.2f}</td>
    <td class="net-sal-lbl">Total Deductions</td>
    <td class="amt">Rs. {total_deductions:,.2f}</td>
  </tr>
</table>

<table style="margin-bottom: 0;">
  <tr>
    <td class="summary-bg" style="width:30%;">Earned This Month</td>
    <td class="summary-bg amt" style="width:20%;">Rs. {net_salary:,.2f}</td>
    <td class="summary-bg" style="width:30%;">Days in Month</td>
    <td class="summary-bg amt" style="width:20%;">{working_days} days</td>
  </tr>
</table>

<table style="border: none;">
  <tr>
    <td class="grand-total" style="width:50%;">TOTAL AMOUNT PAID</td>
    <td class="grand-total grand-total-val" style="width:50%;">Rs. {net_salary:,.2f}</td>
  </tr>
</table>

<div class="footer">
  This is a computer-generated payslip and does not require a signature.<br>
  Generated on {now_str}
</div>

</body>
</html>"""
    return html


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
             formatted_val = str(val).replace("\n", "<br>")
             rows_html += f'<div class="field-group" style="width: 100%;"><div class="label">{f["label"]}</div><div class="value" style="border: 1px solid #eee; padding: 10px;">{formatted_val}</div></div>'
        else:
             width = "48%" if f.get('width') == 'half' else "23%" if f.get('width') == 'quarter' else "100%"
             rows_html += f'<div class="field-group" style="width: {width}; display: inline-block; vertical-align: top; margin-right: 2%;"><div class="label">{f["label"]}</div><div class="value">{val}</div></div>'

    header_text = pdf_cfg.get('header', '').replace('\n', '<br>')
    html = f"""
    <html>
    <head><style>{css}</style></head>
    <body>
        <div class="header">
            <table>
                <tr>
                    <td>
                        {f'<img src="{pdf_cfg["logo"]}" class="logo" />' if pdf_cfg.get('logo') else '<div style="font-weight:bold; font-size: 20pt;">OmniERP</div>'}
                        <div style="font-size: 9pt; color: #666; margin-top: 5px;">{header_text}</div>
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
