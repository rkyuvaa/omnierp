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


def generate_payslip_html(record, employee, month_name: str, year: int, pdf_cfg: dict, fields_config: list = None, uan: str = '-', leave_summary: list = None) -> str:
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

    emp_name        = employee.name or '-'
    emp_code        = employee.employee_id or '-'
    designation     = employee.designation or '-'
    department      = employee.department.name if employee.department else '-'
    
    logo_html = f'<img src="{company_logo}" style="width:140px;" />' if company_logo else ''

    css = """
    @page { size: A4; margin: 0.3cm; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #333; line-height: 1.2; }
    .container { width: 100%; }
    
    /* Strict Table Header to fix xhtml2pdf bugs */
    .hdr-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
    .company-name { font-size: 11.5pt; font-weight: bold; color: #1a3c5e; margin-bottom: 1px; }
    .company-info { font-size: 7pt; color: #4b5563; line-height: 1.1; margin-bottom: 1px; }
    
    /* Badge styling using a nested table for strict width control in xhtml2pdf */
    .badge-table { width: 90px; border-collapse: collapse; float: right; }
    .badge-cell { background: #1a3c5e; color: #fff; padding: 2px; font-weight: bold; font-size: 8pt; text-align: center; border-radius: 2px; }
    .month-year { font-weight: bold; font-size: 8.5pt; margin-top: 3px; color: #1e293b; text-align: right; }
    
    /* Info Table - No vertical lines, just clean horizontal rows */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .info-table td { padding: 2px 3px; border-bottom: 1px solid #f1f5f9; }
    .lbl { color: #64748b; font-size: 7pt; width: 15%; }
    .sep { width: 2%; text-align: center; color: #cbd5e1; }
    .val { font-weight: bold; width: 33%; color: #1e293b; font-size: 7.5pt; }
    
    .section-title { background: #f8fafc; border-left: 3px solid #1a3c5e; padding: 2px 6px; font-weight: bold; font-size: 7.5pt; color: #1a3c5e; margin-bottom: 2px; margin-top: 4px; }
    
    /* Component Layout Tables - Strict grid as requested */
    .comp-layout { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    .comp-cell { width: 49%; vertical-align: top; padding: 0; }
    .comp-spacer { width: 2%; }
    
    .hdr-earn { background: #f0fdf4; color: #166534; font-weight: bold; padding: 2.5px 5px; border: 1px solid #e2e8f0; font-size: 7pt; margin-bottom: 1px; }
    .hdr-ded { background: #fef2f2; color: #991b1b; font-weight: bold; padding: 2.5px 5px; border: 1px solid #e2e8f0; font-size: 7pt; margin-bottom: 1px; }
    .hdr-cont { background: #f5f3ff; color: #5b21b6; font-weight: bold; padding: 2.5px 5px; border: 1px solid #e2e8f0; font-size: 7pt; margin-bottom: 1px; }
    .hdr-summ { background: #fff7ed; color: #9a3412; font-weight: bold; padding: 2.5px 5px; border: 1px solid #e2e8f0; font-size: 7pt; margin-bottom: 1px; }
    
    .comp-tbl { width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; }
    .comp-tbl td { padding: 2.5px 5px; border: 1px solid #e2e8f0; font-size: 7.5pt; color: #334155; }
    .comp-tbl td.comp-name { width: 65%; }
    .comp-tbl td.comp-val { width: 35%; text-align: right; }
    .comp-tbl .total-row { font-weight: bold; background: #f8fafc; color: #1e293b; }
    
    /* Net Pay Box */
    .net-tbl { width: 100%; border-collapse: collapse; margin-top: 5px; }
    .net-td { background: #1a3c5e; color: #fff; padding: 6px; text-align: center; border-radius: 3px; }
    .net-title { font-size: 8pt; font-weight: bold; margin-bottom: 2px; opacity: 0.9; }
    .net-val { font-size: 13pt; font-weight: bold; }
    .net-words { font-size: 7pt; margin-top: 3px; font-style: italic; opacity: 0.85; }
    
    .footer-note { text-align: center; font-size: 6.5pt; color: #94a3b8; margin-top: 5px; border-top: 1px solid #f1f5f9; padding-top: 3px; }
    """

    earn_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in earnings.items()])
    ded_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in deductions.items()])
    cont_rows = "".join([f"<tr><td class='comp-name'>{k}</td><td class='comp-val'>{float(v):,.2f}</td></tr>" for k, v in employer_cont.items()])

    leave_rows = ""
    has_active_leaves = False
    if leave_summary:
        for ls in leave_summary:
            # Safely parse values as float (handling None/Null and float matching)
            allocated = float(ls.get('allocated') or 0)
            used = float(ls.get('used') or 0)
            taken_this_month = float(ls.get('taken_this_month') or 0)
            balance = float(ls.get('balance') or 0)
            
            # Skip if allocated, used, taken_this_month, and balance are all 0 or less
            if allocated <= 0 and used <= 0 and taken_this_month <= 0 and balance <= 0:
                continue
                
            has_active_leaves = True
            leave_rows += f"""
            <tr>
                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0;">{ls['name']} ({ls['code']})</td>
                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; text-align: center;">{allocated:.1f}</td>
                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; text-align: center;">{used:.1f}</td>
                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; text-align: center;">{taken_this_month:.1f}</td>
                <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; text-align: center; font-weight: bold;">{balance:.1f}</td>
            </tr>
            """

    leave_section_html = ""
    if has_active_leaves:
        leave_section_html = f"""
            <!-- LEAVE SUMMARY -->
            <div class="section-title">Leave Details</div>
            <table class="comp-tbl" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; font-weight: bold; color: #1a3c5e;">
                        <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Leave Type</td>
                        <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center; width: 15%;">Allocated</td>
                        <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center; width: 15%;">Used (Year)</td>
                        <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center; width: 15%;">Taken This Month</td>
                        <td style="padding: 2.5px 5px; border: 1px solid #e2e8f0; font-weight: bold; text-align: center; width: 15%;">Remaining Balance</td>
                    </tr>
                </thead>
                <tbody>
                    {leave_rows}
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
                    <td style="width: 150px; vertical-align: top; padding-top: 5px;">
                        {logo_html}
                    </td>
                    <td style="vertical-align: top;">
                        <div class="company-name">{company_name}</div>
                        <div class="company-info">{company_address}</div>
                        <div class="company-info">GSTIN: {company_gstin}</div>
                    </td>
                    <td style="width: 130px; vertical-align: top;">
                        <table class="badge-table"><tr><td class="badge-cell">PAYSLIP</td></tr></table>
                        <div class="month-year" style="clear:both;">{month_name} {year}</div>
                    </td>
                </tr>
            </table>

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
                    <td class="lbl"></td><td class="sep"></td><td class="val"></td>
                </tr>
            </table>

            <!-- COMPONENTS ROW 1 -->
            <table class="comp-layout">
                <tr>
                    <td class="comp-cell">
                        <div class="hdr-earn">EARNINGS Amount (Rs.)</div>
                        <table class="comp-tbl">
                            {earn_rows or "<tr><td class='comp-name' colspan='2' style='text-align:center;'>-</td></tr>"}
                            <tr class="total-row"><td class="comp-name">GROSS EARNINGS</td><td class="comp-val">Rs. {total_earnings:,.2f}</td></tr>
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
                            <tr><td class="comp-name">Gross Salary</td><td class="comp-val">{total_earnings:,.2f}</td></tr>
                            <tr><td class="comp-name">Employer Contributions</td><td class="comp-val">{total_employer_cont:,.2f}</td></tr>
                            <tr class="total-row"><td class="comp-name">MONTHLY CTC</td><td class="comp-val">Rs. {monthly_ctc:,.2f}</td></tr>
                        </table>
                    </td>
                </tr>
            </table>

            <!-- NET PAY -->
            <table class="net-tbl">
                <tr>
                    <td class="net-td">
                        <div class="net-title">TOTAL IN-HAND SALARY (NET PAY)</div>
                        <div class="net-val">Rs. {net_salary:,.2f}</div>
                        <div class="net-words">({net_words})</div>
                    </td>
                </tr>
            </table>

            {leave_section_html}
            
            <div class="footer-note">
                {footer_text}<br>
                Generated on {calendar.monthrange(year, record.month)[1]}-{month_name[:3]}-{year}
            </div>
        </div>
    </body>
    </html>
    """
    return html
