from xhtml2pdf import pisa
from io import BytesIO
import base64
import calendar

def render_to_pdf(html_content: str):
    """
    Converts HTML content to a PDF binary stream.
    """
    result = BytesIO()
    # xhtml2pdf handles encoding better if we pass it correctly
    pdf = pisa.pisaDocument(BytesIO(html_content.encode("utf-8")), result, encoding="utf-8")
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
    for f in fields:
        val = data.get(f.get('key', ''), '-')
        ftype = f.get('type', 'text')
        
        if ftype == 'separator':
            rows_html += f'<hr style="border:none; border-top:1px solid #ccc; margin: 15px 0;" />'
        elif ftype == 'heading':
            rows_html += f'<div style="font-size: 13pt; font-weight: bold; color: #1e3a8a; margin: 20px 0 10px 0; border-bottom: 1px solid #eee;">{f.get("label", "").upper()}</div>'
        elif ftype == 'table':
            rows_html += f'<div class="label">{f.get("label", "")}: Table data skipped in preview</div>'
        else:
            width = "48%" if f.get('width') == 'half' else "100%"
            rows_html += f'<div class="field-group" style="width: {width}; display: inline-block; vertical-align: top;"><div class="label">{f.get("label", "")}</div><div class="value">{val}</div></div>'

    html = f"""<html><head><meta charset="utf-8"/><style>{css}</style></head><body>{rows_html}</body></html>"""
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
    company_address = pdf_cfg.get('header', 'Konwert India Motors Private Limited').replace('\n', '<br>')
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

    emp_name        = employee.name or '-'
    emp_code        = employee.employee_id or '-'
    designation     = employee.designation or '-'
    department      = employee.department.name if employee.department else '-'
    
    # Leave Details logic - using simple key-value format instead of table
    leave_items = []
    if hasattr(employee, 'leave_balances') and employee.leave_balances:
        for bal in employee.leave_balances:
            leave_items.append({
                "name": bal.leave_type.name,
                "op": bal.allocated_days,
                "ed": bal.used_days,
                "cl": bal.allocated_days - bal.used_days
            })
    else:
        leave_items = [
            {"name": "Casual Leave (CL)", "op": 0, "ed": 0, "cl": 0},
            {"name": "Sick Leave (SL)", "op": 0, "ed": 0, "cl": 0},
            {"name": "Earned Leave (EL)", "op": 0, "ed": 0, "cl": 0}
        ]

    leave_html = ""
    for item in leave_items:
        leave_html += f"""
        <tr>
            <td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6; width:30%;">{item['name']}</td>
            <td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6; width:15%; text-align:center;">{item['op']}</td>
            <td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6; width:15%; text-align:center;">{item['ed']}</td>
            <td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6; width:15%; text-align:center;">0</td>
            <td style="padding: 4px 0; border-bottom: 1px solid #f3f4f6; width:25%; text-align:right;">{item['cl']}</td>
        </tr>
        """

    logo_html = f'<img src="{company_logo}" style="height:45px;" />' if company_logo else f'<div style="font-size:16pt; font-weight:bold; color:#1a3c5e;">{company_name}</div>'

    css = """
    @page { size: A4; margin: 1cm; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 9pt; color: #333; line-height: 1.3; }
    .container { width: 100%; }
    
    /* Header */
    .hdr-tbl { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .company-title { font-size: 15pt; font-weight: bold; color: #000; }
    .company-addr { font-size: 8pt; color: #666; }
    .slip-badge { background: #1e3a8a; color: #fff; padding: 4px 10px; font-weight: bold; border-radius: 2px; }
    
    /* Section Labels */
    .section-hdr { background: #eff6ff; padding: 5px 10px; font-weight: bold; font-size: 8.5pt; color: #1e40af; border-radius: 3px; margin-bottom: 10px; margin-top: 15px; }
    
    /* Info Grid (No borders) */
    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .info-grid td { padding: 4px 5px; vertical-align: middle; }
    .lbl { color: #6b7280; width: 18%; }
    .sep { width: 2%; text-align: center; color: #9ca3af; }
    .val { font-weight: bold; width: 30%; color: #111; }
    
    /* Components (Clean layout) */
    .comp-wrap { width: 100%; margin-bottom: 15px; }
    .comp-col { width: 49%; display: inline-block; vertical-align: top; }
    .comp-hdr { padding: 5px 10px; font-weight: bold; font-size: 8pt; border-radius: 3px 3px 0 0; }
    .earn-hdr { background: #dcfce7; color: #166534; }
    .ded-hdr { background: #fee2e2; color: #991b1b; }
    .cont-hdr { background: #f3e8ff; color: #6b21a8; }
    .summ-hdr { background: #ffedd5; color: #9a3412; }
    
    .comp-tbl { width: 100%; border-collapse: collapse; }
    .comp-tbl td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; font-size: 8.5pt; }
    .comp-tbl .total-row { font-weight: bold; background: #fafafa; }
    
    /* Net Pay */
    .net-box { background: #eff6ff; padding: 15px; border-radius: 4px; margin-top: 15px; }
    .net-amt { font-size: 16pt; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; }
    .net-words { font-size: 8.5pt; color: #4b5563; font-weight: bold; }
    """

    earn_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.0f}</td></tr>" for k, v in earnings.items()])
    ded_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.0f}</td></tr>" for k, v in deductions.items()])
    cont_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.0f}</td></tr>" for k, v in employer_cont.items()])

    html = f"""
    <html>
    <head><meta charset="utf-8"/><style>{css}</style></head>
    <body>
        <div class="container">
            <table class="hdr-tbl">
                <tr>
                    <td style="width:100px;">{logo_html}</td>
                    <td style="padding-left:15px;">
                        <div class="company-title">{company_name}</div>
                        <div class="company-addr">{company_address}</div>
                    </td>
                    <td style="text-align:right; vertical-align:middle;">
                        <span class="slip-badge">PAYSLIP</span>
                        <div style="font-weight:bold; font-size:11pt; margin-top:5px;">{month_name} {year}</div>
                    </td>
                </tr>
            </table>

            <div class="section-hdr">Employee Details</div>
            <table class="info-grid">
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

            <div class="comp-wrap">
                <div class="comp-col" style="margin-right:2%;">
                    <div class="comp-hdr earn-hdr">EARNINGS <span style="float:right">Amount (Rs.)</span></div>
                    <table class="comp-tbl">
                        {earn_rows or "<tr><td colspan='2'>-</td></tr>"}
                        <tr class="total-row"><td>GROSS EARNINGS</td><td style="text-align:right;">Rs. {total_earnings:,.0f}</td></tr>
                    </table>
                </div>
                <div class="comp-col">
                    <div class="comp-hdr ded-hdr">DEDUCTIONS <span style="float:right">Amount (Rs.)</span></div>
                    <table class="comp-tbl">
                        {ded_rows or "<tr><td colspan='2'>-</td></tr>"}
                        <tr class="total-row"><td>TOTAL DEDUCTIONS</td><td style="text-align:right;">Rs. {total_deductions:,.0f}</td></tr>
                    </table>
                </div>
            </div>

            <div class="comp-wrap">
                <div class="comp-col" style="margin-right:2%;">
                    <div class="comp-hdr cont-hdr">EMPLOYER CONTRIBUTIONS <span style="float:right">Amount (Rs.)</span></div>
                    <table class="comp-tbl">
                        {cont_rows or "<tr><td colspan='2'>-</td></tr>"}
                        <tr class="total-row"><td>TOTAL CONTRIBUTIONS</td><td style="text-align:right;">Rs. {total_employer_cont:,.0f}</td></tr>
                    </table>
                </div>
                <div class="comp-col">
                    <div class="comp-hdr summ-hdr">CTC SUMMARY <span style="float:right">Amount (Rs.)</span></div>
                    <table class="comp-tbl">
                        <tr><td>Gross Salary</td><td style="text-align:right;">{total_earnings:,.0f}</td></tr>
                        <tr><td>Employer Contributions</td><td style="text-align:right;">{total_employer_cont:,.0f}</td></tr>
                        <tr class="total-row"><td>MONTHLY CTC</td><td style="text-align:right;">Rs. {monthly_ctc:,.0f}</td></tr>
                    </table>
                </div>
            </div>

            <div class="section-hdr">Leave Details</div>
            <table class="comp-tbl" style="width:100%;">
                <tr style="font-weight:bold; color:#666; font-size:8pt;">
                    <td style="width:30%;">Leave Type</td>
                    <td style="width:15%; text-align:center;">Opening</td>
                    <td style="width:15%; text-align:center;">Earned</td>
                    <td style="width:15%; text-align:center;">Utilized</td>
                    <td style="width:25%; text-align:right;">Closing Balance</td>
                </tr>
                {leave_html}
            </table>

            <div class="net-box">
                <div style="font-weight:bold; color:#1e3a8a; font-size:10pt;">NET PAY (In-Hand Salary)</div>
                <div class="net-amt">Rs. {net_salary:,.0f}</div>
                <div class="net-words">({net_words})</div>
            </div>
            
            <div style="text-align:center; font-size:8pt; color:#999; margin-top:20px;">{footer_text}</div>
        </div>
    </body></html>
    """
    return html
