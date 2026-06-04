from xhtml2pdf import pisa
from io import BytesIO
import base64
import calendar

def render_to_pdf(html_content: str):
    """
    Converts HTML content to a PDF binary stream.
    """
    result = BytesIO()
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
    
    css = """
    @page { size: A4; margin: 1.5cm; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.5; }
    .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
    .header table { width: 100%; }
    .label { font-size: 9pt; font-weight: bold; color: #777; margin-bottom: 2px; text-transform: uppercase; }
    .value { font-size: 11pt; border-bottom: 1px solid #eee; min-height: 20px; padding: 2px 0; }
    """
    
    rows_html = ""
    for f in fields:
        val = data.get(f.get('key', ''), '-')
        width = "48%" if f.get('width') == 'half' else "100%"
        rows_html += f'<div style="width: {width}; display: inline-block; vertical-align: top; margin-bottom: 10px;"><div class="label">{f.get("label", "")}</div><div class="value">{val}</div></div>'

    return f"""<html><head><meta charset="utf-8"/><style>{css}</style></head><body>{rows_html}</body></html>"""


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


def generate_payslip_html(record, employee, month_name: str, year: int, pdf_cfg: dict, fields_config: list = None, uan: str = '-', leave_summary: list = None, esi_number: str = '-', pending_holds: list = None) -> str:
    company_name    = 'Konwert India Motors Private Limited'
    company_address = 'SF No 237/1B2, Near PSBB School Vadavalli, Coimbatore - 641108'
    company_gstin   = '33AAHCK7681B1ZL'
    
    company_logo    = pdf_cfg.get('logo', '')
    footer_text     = 'This payslip is system generated and does not require a signature.'

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
    # CTC SUMMARY uses regular gross only (arrears excluded per Indian standard)
    regular_gross = sum(float(v) for k, v in earnings.items() if 'Arrear' not in k)
    regular_ctc   = regular_gross + total_employer_cont

    emp_name        = employee.name or '-'
    emp_code        = employee.employee_id or '-'
    designation     = employee.designation or '-'
    department      = employee.department.name if employee.department else '-'
    
    logo_html = f'<img src="{company_logo}" style="width:140px;" />' if company_logo else ''

    css = """
    @page { size: A4; margin: 0.5cm; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #333; line-height: 1.3; }
    .container { width: 100%; }
    
    /* Strict Table Header to fix xhtml2pdf bugs */
    .hdr-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .company-name { font-size: 16pt; font-weight: bold; color: #195402; margin-bottom: 4px; }
    .company-info { font-size: 8.5pt; color: #475569; line-height: 1.35; }
    
    .payslip-title { font-size: 20pt; font-weight: bold; color: #195402; text-align: right; letter-spacing: 0.5px; }
    .payslip-month { font-weight: bold; font-size: 10pt; color: #475569; text-align: right; margin-top: 3px; }
    
    /* Info Table - No vertical lines, just clean horizontal rows */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .info-table td { padding: 5px 4px; border-bottom: 1px solid #f1f5f9; }
    .lbl { color: #64748b; font-size: 8pt; width: 15%; }
    .sep { width: 2%; text-align: center; color: #cbd5e1; }
    .val { font-weight: bold; width: 33%; color: #1e293b; font-size: 8.5pt; }
    
    .section-title { background: #f8fafc; border-left: 3px solid #195402; padding: 5px 10px; font-weight: bold; font-size: 8.5pt; color: #195402; margin-bottom: 8px; margin-top: 10px; }
    
    /* Component Layout Tables - Strict grid as requested */
    .comp-layout { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    .comp-cell { width: 49%; vertical-align: top; padding: 0; }
    .comp-spacer { width: 2%; }
    
    .hdr-earn { background: #f0fdf4; color: #195402; font-weight: bold; padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 8pt; margin-bottom: 2px; }
    .hdr-ded { background: #f0fdf4; color: #195402; font-weight: bold; padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 8pt; margin-bottom: 2px; }
    .hdr-cont { background: #f0fdf4; color: #195402; font-weight: bold; padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 8pt; margin-bottom: 2px; }
    .hdr-summ { background: #f0fdf4; color: #195402; font-weight: bold; padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 8pt; margin-bottom: 2px; }
    
    .comp-tbl { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
    .comp-tbl td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 8.5pt; color: #334155; }
    .comp-tbl td.comp-name { width: 65%; }
    .comp-tbl td.comp-val { width: 35%; text-align: right; }
    .comp-tbl .total-row { font-weight: bold; background: #f8fafc; color: #1e293b; }
    
    /* Net Pay Box */
    .net-tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .net-td { background: #195402; color: #fff; padding: 9px; text-align: center; border-radius: 4px; }
    .net-title { font-size: 9pt; font-weight: bold; margin-bottom: 3px; opacity: 0.9; }
    .net-val { font-size: 18pt; font-weight: bold; }
    .net-words { font-size: 8pt; margin-top: 4px; font-style: italic; opacity: 0.85; }
    
    .footer-note { text-align: center; font-size: 7.5pt; color: #94a3b8; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
    """

    regular_earnings = {k: v for k, v in earnings.items() if 'Arrear' not in k}
    arrear_earnings = {k: v for k, v in earnings.items() if 'Arrear' in k}

    earn_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in regular_earnings.items()])
    arrear_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in arrear_earnings.items()])
    ded_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in deductions.items()])
    cont_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in employer_cont.items()])

    leave_rows = ""
    has_active_leaves = False
    if leave_summary:
        for ls in leave_summary:
            code = (ls.get('code') or '').upper()
            if code not in ['CL', 'SL']:
                continue
                
            taken_this_month = float(ls.get('taken_this_month') or 0)
            has_active_leaves = True
            leave_rows += f"""
            <tr>
                <td style="padding: 5px 8px; border: 1px solid #e2e8f0;">{ls['name']} ({ls['code']})</td>
                <td style="padding: 5px 8px; border: 1px solid #e2e8f0; text-align: center;">{taken_this_month:.1f}</td>
            </tr>
            """

    leave_section_html = ""
    if has_active_leaves:
        leave_section_html = f"""
            <!-- LEAVE SUMMARY -->
            <div class="section-title">Leave Details</div>
            <table class="comp-tbl" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; font-weight: bold; color: #195402;">
                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: bold; width: 60%;">Leave Type</td>
                        <td style="padding: 5px 8px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center; width: 40%;">Taken This Month</td>
                    </tr>
                </thead>
                <tbody>
                    {leave_rows}
                </tbody>
            </table>
        """

    # ── Pending Salary Holds section ───────────────────────────────────────────
    pending_holds_html = ""
    if pending_holds:
        holds_total = sum(h["amount"] for h in pending_holds)
        hold_rows_html = "".join([
            f"""<tr>
                <td style="padding:5px 8px;border:1px solid #e2e8f0;">{h['month']} {h['year']}</td>
                <td style="padding:5px 8px;border:1px solid #e2e8f0;">{h['remarks']}</td>
                <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right;color:#dc2626;font-weight:600;">Rs. {h['amount']:,.2f}</td>
            </tr>"""
            for h in pending_holds
        ])
        pending_holds_html = f"""
            <div class="section-title" style="background:#fff7ed;border-left-color:#d97706;color:#92400e;margin-top:10px;">Pending Salary Holds (Informational - Not Deducted This Month)</div>
            <table class="comp-tbl" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#fff7ed;font-weight:bold;color:#92400e;">
                        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:bold;width:20%;">Period</td>
                        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:bold;width:50%;">Remarks</td>
                        <td style="padding:5px 8px;border:1px solid #e2e8f0;font-weight:bold;text-align:right;width:30%;">Amount Held</td>
                    </tr>
                </thead>
                <tbody>
                    {hold_rows_html}
                    <tr style="font-weight:bold;background:#fef3c7;">
                        <td style="padding:5px 8px;border:1px solid #e2e8f0;" colspan="2">TOTAL PENDING SALARY HOLD</td>
                        <td style="padding:5px 8px;border:1px solid #e2e8f0;text-align:right;color:#dc2626;">Rs. {holds_total:,.2f}</td>
                    </tr>
                </tbody>
            </table>
        """

    html = f"""
    <html>
    <head><meta charset="utf-8"/><style>{css}</style></head>
    <body>
        <div class="container">
            <!-- HEADER -->
            <table class="hdr-table">
                <tr>
                    <td style="width: 150px; vertical-align: middle;">
                        {logo_html}
                    </td>
                    <td style="vertical-align: middle; padding-left: 10px;">
                        <div class="company-name">{company_name}</div>
                        <div class="company-info">{company_address}</div>
                        <div class="company-info">GSTIN: {company_gstin}</div>
                    </td>
                    <td style="width: 150px; vertical-align: middle; text-align: right;">
                        <div class="payslip-title">PAYSLIP</div>
                        <div class="payslip-month">{month_name} {year}</div>
                    </td>
                </tr>
            </table>

            <!-- Divider Line -->
            <div style="border-bottom: 1.5px solid #cbd5e1; margin-bottom: 15px; margin-top: 10px; clear: both;"></div>

            <!-- EMPLOYEE INFO -->
            <div class="section-title">Employee Information</div>
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
                <tr>
                    <td class="lbl">UAN</td><td class="sep">:</td><td class="val">{uan}</td>
                    <td class="lbl">ESI Number</td><td class="sep">:</td><td class="val">{esi_number}</td>
                </tr>
            </table>

            <!-- COMPONENTS ROW 1 -->
            <table class="comp-layout">
                <tr>
                    <td class="comp-cell">
                        <div class="hdr-earn">EARNINGS Amount (Rs.)</div>
                        <table class="comp-tbl">
                            {earn_rows or "<tr><td class='comp-name' colspan='2' style='text-align:center;'>-</td></tr>"}
                            <tr class="total-row"><td class="comp-name">GROSS EARNINGS</td><td class="comp-val">Rs. {regular_gross:,.2f}</td></tr>
                            {arrear_rows}
                            {f'<tr class="total-row"><td class="comp-name">GROSS WITH ARREAR</td><td class="comp-val">Rs. {total_earnings:,.2f}</td></tr>' if arrear_earnings else ''}
                        </table>
                    </td>
                    <td class="comp-spacer"></td>
                    <td class="comp-cell">
                        <div class="hdr-ded">DEDUCTIONS Amount (Rs.)</div>
                        <table class="comp-tbl">
                            {ded_rows or "<tr><td class='comp-name' colspan='2' style='text-align:center;'>-</td></tr>"}
                            <tr class="total-row"><td class="comp-name">TOTAL DEDUCTIONS</td><td class="comp-val">Rs. {total_deductions:,.2f}</td></tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- COMPONENTS ROW 2 -->
            <table class="comp-layout">
                <tr>
                    <td class="comp-cell">
                        <div class="hdr-cont">EMPLOYER CONTRIBUTIONS Amount (Rs.)</div>
                        <table class="comp-tbl">
                            {cont_rows or "<tr><td class='comp-name' colspan='2' style='text-align:center;'>-</td></tr>"}
                            <tr class="total-row"><td class="comp-name">TOTAL CONTRIBUTIONS</td><td class="comp-val">Rs. {total_employer_cont:,.2f}</td></tr>
                        </table>
                    </td>
                    <td class="comp-spacer"></td>
                    <td class="comp-cell">
                        <div class="hdr-summ">CTC SUMMARY Amount (Rs.)</div>
                        <table class="comp-tbl">
                            <tr><td class="comp-name">Gross Salary</td><td class="comp-val">{regular_gross:,.2f}</td></tr>
                            <tr><td class="comp-name">Employer Contributions</td><td class="comp-val">{total_employer_cont:,.2f}</td></tr>
                            <tr class="total-row"><td class="comp-name">MONTHLY CTC</td><td class="comp-val">Rs. {regular_ctc:,.2f}</td></tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- NET PAY -->
            <table class="net-tbl">
                <tr>
                    <td class="net-td">
                        <div class="net-title">TOTAL IN-HAND SALARY (NET PAY)</div>
                        <div class="net-val">Rs. {round(net_salary):,}</div>
                        <div class="net-words">({net_words})</div>
                    </td>
                </tr>
            </table>

            {leave_section_html}
            {pending_holds_html}
            
            <div class="footer-note">
                {footer_text}<br>
                Generated on {calendar.monthrange(year, record.month)[1]}-{month_name[:3]}-{year}
            </div>
        </div>
    </body>
    </html>
    """
    return html
