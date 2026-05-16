from xhtml2pdf import pisa
from io import BytesIO
import base64
import calendar

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
    Generate a professional Indian-format payslip HTML matching the provided design.
    """
    company_name    = pdf_cfg.get('company_name', 'Konwert India Motors Private Limited')
    company_address = pdf_cfg.get('header', 'SF No 237/1B2, Near PSBB School Vadavalli, Coimbatore - 641108').replace('\n', '<br>')
    company_logo    = pdf_cfg.get('logo', '')
    footer_text     = pdf_cfg.get('footer', 'This is a computer-generated payslip. No signature required.')

    breakdown       = record.components_breakdown or {}
    earnings        = breakdown.get('earnings', {})
    deductions      = breakdown.get('deductions', {})
    employer_cont   = breakdown.get('employer_contributions', {})
    
    total_earnings  = float(record.total_earnings or 0)
    total_deductions= float(record.total_deductions or 0)
    net_salary      = float(record.net_salary or 0)
    net_words       = num_to_words(net_salary) + ' Rupees Only'
    
    total_employer_cont = sum(float(v) for v in employer_cont.values())
    monthly_ctc = total_earnings + total_employer_cont

    emp_name        = employee.name or '—'
    emp_code        = employee.employee_id or '—'
    designation     = employee.designation or '—'
    department      = employee.department.name if employee.department else '—'
    
    # Leave Balances logic
    leave_rows = ""
    # In a real scenario, we'd fetch HRLeaveBalance for the employee
    # Assuming record or employee has balances attached or we fetch them elsewhere
    # For now, we try to see if it's in record or we just show placeholders
    if hasattr(employee, 'leave_balances') and employee.leave_balances:
        for bal in employee.leave_balances:
            leave_rows += f"<tr><td>{bal.leave_type.name}</td><td>{bal.allocated_days}</td><td>{bal.used_days}</td><td>{bal.allocated_days - bal.used_days}</td></tr>"
    else:
        # Better fallback: check if we can fetch some typical leave types
        leave_rows = """
        <tr><td>Casual Leave (CL)</td><td>—</td><td>—</td><td>—</td></tr>
        <tr><td>Sick Leave (SL)</td><td>—</td><td>—</td><td>—</td></tr>
        <tr><td>Earned Leave (EL)</td><td>—</td><td>—</td><td>—</td></tr>
        """

    logo_html = f'<img src="{company_logo}" style="height:50px;" />' if company_logo else f'<div style="font-size:18pt; font-weight:bold; color:#1a3c5e;">{company_name}</div>'

    css = """
    @page { size: A4; margin: 1cm; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 9pt; color: #333; line-height: 1.4; }
    .container { width: 100%; }
    
    /* Header */
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .header-table td { vertical-align: top; }
    .company-info { padding-left: 15px; }
    .company-title { font-size: 16pt; font-weight: bold; color: #000; margin-bottom: 2px; }
    .company-addr { font-size: 8.5pt; color: #555; }
    .slip-badge { background: #1e3a8a; color: #fff; padding: 4px 12px; font-weight: bold; text-align: center; border-radius: 2px; font-size: 10pt; }
    .slip-date { text-align: right; margin-top: 5px; font-weight: bold; font-size: 11pt; }
    
    /* Section Headers */
    .section-hdr { background: #eff6ff; border: 1px solid #dbeafe; padding: 4px 10px; font-weight: bold; font-size: 8.5pt; color: #1e40af; text-transform: uppercase; margin-bottom: 5px; border-radius: 2px; }
    
    /* Info Table */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #e5e7eb; border-radius: 4px; }
    .info-table td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; width: 25%; }
    .info-table td.lbl { color: #6b7280; font-weight: normal; width: 15%; }
    .info-table td.sep { width: 2%; text-align: center; color: #9ca3af; }
    .info-table td.val { font-weight: 500; width: 33%; }
    
    /* Components Grid */
    .comp-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .comp-grid td { width: 50%; vertical-align: top; padding: 0; }
    .comp-grid td:first-child { padding-right: 8px; }
    .comp-grid td:last-child { padding-left: 8px; }
    
    .comp-box { border: 1px solid #e5e7eb; border-radius: 4px; overflow: hidden; min-height: 150px; }
    .box-hdr { padding: 4px 10px; font-weight: bold; font-size: 8.5pt; }
    .box-hdr.earn { background: #dcfce7; color: #166534; }
    .box-hdr.ded { background: #fee2e2; color: #991b1b; }
    .box-hdr.cont { background: #f3e8ff; color: #6b21a8; }
    .box-hdr.summ { background: #ffedd5; color: #9a3412; }
    
    .comp-tbl { width: 100%; border-collapse: collapse; }
    .comp-tbl td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; font-size: 8.5pt; }
    .comp-tbl td.amt { text-align: right; }
    .box-footer { background: #f9fafb; padding: 6px 10px; font-weight: bold; border-top: 1px solid #e5e7eb; }
    .box-footer table { width: 100%; border-collapse: collapse; }
    .box-footer td.amt { text-align: right; }
    
    /* Leave Table */
    .leave-tbl { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; margin-bottom: 20px; }
    .leave-tbl th { background: #f9fafb; border: 1px solid #e5e7eb; padding: 5px; font-size: 8pt; color: #4b5563; text-align: left; }
    .leave-tbl td { border: 1px solid #e5e7eb; padding: 5px; font-size: 8.5pt; }
    
    /* Net Pay Box */
    .net-pay-box { border: 1px solid #1e40af; border-radius: 4px; overflow: hidden; display: table; width: 100%; margin-top: 10px; }
    .net-lbl { display: table-cell; width: 30%; background: #eff6ff; padding: 15px; vertical-align: middle; border-right: 1px solid #dbeafe; }
    .net-lbl div:first-child { font-weight: bold; font-size: 11pt; color: #1e3a8a; }
    .net-lbl div:last-child { font-size: 8pt; color: #3b82f6; }
    .net-val { display: table-cell; width: 70%; padding: 15px; text-align: center; vertical-align: middle; }
    .net-amt { font-size: 18pt; font-weight: bold; color: #000; margin-bottom: 5px; }
    .net-word-str { font-size: 8.5pt; color: #4b5563; font-weight: bold; }
    """

    earn_rows = "".join([f"<tr><td>{k}</td><td class='amt'>{float(v):,.0f}</td></tr>" for k, v in earnings.items()])
    ded_rows = "".join([f"<tr><td>{k}</td><td class='amt'>{float(v):,.0f}</td></tr>" for k, v in deductions.items()])
    cont_rows = "".join([f"<tr><td>{k}</td><td class='amt'>{float(v):,.0f}</td></tr>" for k, v in employer_cont.items()])

    html = f"""
    <html>
    <head><style>{css}</style></head>
    <body>
        <div class="container">
            <table class="header-table">
                <tr>
                    <td style="width:100px;">{logo_html}</td>
                    <td class="company-info">
                        <div class="company-title">{company_name}</div>
                        <div class="company-addr">{company_address}</div>
                    </td>
                    <td style="width:150px; text-align:right;">
                        <div class="slip-badge">PAYSLIP</div>
                        <div class="slip-date">{month_name} {year}</div>
                    </td>
                </tr>
            </table>

            <div class="section-hdr">Employee Details</div>
            <table class="info-table">
                <tr>
                    <td class="lbl">Employee Name</td><td class="sep">:</td><td class="val">{emp_name}</td>
                    <td class="lbl">Department</td><td class="sep">:</td><td class="val">{department}</td>
                </tr>
                <tr>
                    <td class="lbl">Employee ID</td><td class="sep">:</td><td class="val">{emp_code}</td>
                    <td class="lbl">Pay Period</td><td class="sep">:</td><td class="val">{month_name} {year}</td>
                </tr>
                <tr>
                    <td class="lbl">Designation</td><td class="sep">:</td><td class="val">{designation}</td>
                    <td class="lbl">Pay Date</td><td class="sep">:</td><td class="val">{calendar.monthrange(year, record.month)[1]}-{month_name[:3]}-{year}</td>
                </tr>
            </table>

            <table class="comp-grid">
                <tr>
                    <td>
                        <div class="comp-box">
                            <div class="box-hdr earn">EARNINGS <span style="float:right">Amount (₹)</span></div>
                            <table class="comp-tbl">{earn_rows or "<tr><td colspan='2'>—</td></tr>"}</table>
                            <div class="box-footer">
                                <table><tr><td>GROSS EARNINGS</td><td class="amt">₹ {total_earnings:,.0f}</td></tr></table>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="comp-box">
                            <div class="box-hdr ded">DEDUCTIONS <span style="float:right">Amount (₹)</span></div>
                            <table class="comp-tbl">{ded_rows or "<tr><td colspan='2'>—</td></tr>"}</table>
                            <div class="box-footer">
                                <table><tr><td>TOTAL DEDUCTIONS</td><td class="amt">₹ {total_deductions:,.0f}</td></tr></table>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>

            <table class="comp-grid">
                <tr>
                    <td>
                        <div class="comp-box">
                            <div class="box-hdr cont">EMPLOYER CONTRIBUTIONS (CTC COMPONENTS) <span style="float:right">Amount (₹)</span></div>
                            <table class="comp-tbl">{cont_rows or "<tr><td colspan='2'>—</td></tr>"}</table>
                            <div class="box-footer">
                                <table><tr><td>TOTAL EMPLOYER CONTRIBUTIONS</td><td class="amt">₹ {total_employer_cont:,.0f}</td></tr></table>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="comp-box">
                            <div class="box-hdr summ">CTC SUMMARY <span style="float:right">Amount (₹)</span></div>
                            <table class="comp-tbl">
                                <tr><td>Gross Salary</td><td class="amt">{total_earnings:,.0f}</td></tr>
                                <tr><td>Employer Contributions</td><td class="amt">{total_employer_cont:,.0f}</td></tr>
                            </table>
                            <div class="box-footer">
                                <table><tr><td>MONTHLY CTC</td><td class="amt">₹ {monthly_ctc:,.0f}</td></tr></table>
                            </div>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="section-hdr">Leave Details</div>
            <table class="leave-tbl">
                <thead>
                    <tr><th>Leave Type</th><th>Opening Balance</th><th>Earned</th><th>Utilized</th><th>Closing Balance</th></tr>
                </thead>
                <tbody>{leave_rows}</tbody>
            </table>

            <div class="net-pay-box">
                <div class="net-lbl">
                    <div>NET PAY</div>
                    <div>(In-Hand Salary)</div>
                </div>
                <div class="net-val">
                    <div class="net-amt">₹ {net_salary:,.0f}</div>
                    <div class="net-word-str">({net_words})</div>
                </div>
            </div>
            
            <div style="text-align:center; font-size:8pt; color:#999; margin-top:20px;">{footer_text}</div>
        </div>
    </body>
    </html>
    """
    return html
