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


def generate_payslip_html(record, employee, month_name: str, year: int, pdf_cfg: dict, fields_config: list = None) -> str:
    company_name    = 'Konwert India Motors Private Limited'
    company_address = 'SF No 237/1B2, Near PSBB School Vadavalli, Coimbatore - 641108'
    company_gstin   = '33AAHCK7681B1ZL'
    
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
    
    logo_html = f'<img src="{company_logo}" style="height:50px;" />' if company_logo else ''

    css = """
    @page { size: A4; margin: 1cm; }
    body { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #333; line-height: 1.4; }
    .container { width: 100%; }
    
    /* Header Table */
    .hdr-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
    .company-name { font-size: 16pt; font-weight: bold; color: #1a3c5e; margin-bottom: 3px; white-space: nowrap; }
    .company-info { font-size: 8.5pt; color: #4b5563; line-height: 1.3; }
    .payslip-badge-box { background: #1a3c5e; color: #fff; padding: 6px 15px; font-weight: bold; font-size: 10pt; text-align: center; border-radius: 3px; display: inline-block; width: 100px; }
    .month-year { font-weight: bold; font-size: 12pt; margin-top: 8px; color: #1e293b; text-align: right; }
    
    /* Info Table - Unified Spacing */
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .info-table td { padding: 6px 4px; border-bottom: 1px solid #f1f5f9; }
    .lbl { color: #64748b; width: 18%; font-size: 8.5pt; }
    .sep { width: 2%; text-align: center; color: #cbd5e1; }
    .val { font-weight: bold; width: 30%; color: #1e293b; font-size: 9pt; }
    
    /* Sections */
    .section-title { background: #f8fafc; border-left: 4px solid #1a3c5e; padding: 7px 12px; font-weight: bold; font-size: 9pt; color: #1a3c5e; margin-bottom: 12px; margin-top: 15px; text-transform: uppercase; }
    
    /* Side-by-Side Component Tables */
    .comp-layout { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .comp-cell { width: 49%; vertical-align: top; padding: 0; }
    .comp-spacer { width: 2%; }
    
    .comp-box { border: 1px solid #e2e8f0; border-radius: 5px; overflow: hidden; background: #fff; }
    .box-hdr { padding: 7px 12px; font-weight: bold; font-size: 8.5pt; border-bottom: 1px solid #e2e8f0; }
    .box-hdr.earn { background: #f0fdf4; color: #166534; }
    .box-hdr.ded { background: #fef2f2; color: #991b1b; }
    .box-hdr.cont { background: #f5f3ff; color: #5b21b6; }
    .box-hdr.summ { background: #fff7ed; color: #9a3412; }
    
    .comp-tbl { width: 100%; border-collapse: collapse; }
    .comp-tbl td { padding: 7px 12px; border-bottom: 1px solid #f8fafc; font-size: 9pt; color: #334155; }
    .comp-tbl .total-row { font-weight: bold; background: #f8fafc; border-top: 1px solid #e2e8f0; color: #1e293b; }
    
    /* Leave Summary */
    .leave-tbl { width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 5px; overflow: hidden; }
    .leave-tbl th { background: #f8fafc; color: #64748b; font-size: 8.5pt; padding: 8px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    .leave-tbl td { padding: 8px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 9pt; color: #334155; }
    
    /* Net Pay Box - Premium Look */
    .net-box { background: #1a3c5e; color: #fff; padding: 25px; border-radius: 5px; margin-top: 25px; text-align: center; }
    .net-title { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; opacity: 0.9; }
    .net-val { font-size: 20pt; font-weight: bold; }
    .net-words { font-size: 9pt; margin-top: 10px; font-style: italic; opacity: 0.85; }
    
    .footer-note { text-align: center; font-size: 8pt; color: #94a3b8; margin-top: 35px; border-top: 1px solid #f1f5f9; padding-top: 15px; }
    """

    earn_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.2f}</td></tr>" for k, v in earnings.items()])
    ded_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.2f}</td></tr>" for k, v in deductions.items()])
    cont_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.2f}</td></tr>" for k, v in employer_cont.items()])

    leave_rows = ""
    if hasattr(employee, 'leave_balances') and employee.leave_balances:
        for bal in employee.leave_balances:
            leave_rows += f"<tr><td style='text-align:left; font-weight:bold;'>{bal.leave_type.name}</td><td>{bal.allocated_days}</td><td>{bal.used_days}</td><td>0</td><td style='text-align:right; font-weight:bold;'>{bal.allocated_days - bal.used_days}</td></tr>"
    else:
        for lt in ["Casual Leave (CL)", "Sick Leave (SL)", "Earned Leave (EL)"]:
             leave_rows += f"<tr><td style='text-align:left; font-weight:bold;'>{lt}</td><td>0</td><td>0</td><td>0</td><td style='text-align:right; font-weight:bold;'>0</td></tr>"

    html = f"""
    <html>
    <head><meta charset="utf-8"/><style>{css}</style></head>
    <body>
        <div class="container">
            <table class="hdr-table">
                <tr>
                    {f'<td style="width:10%;">{logo_html}</td>' if logo_html else ''}
                    <td style="width:65%;">
                        <div class="company-name">{company_name}</div>
                        <div class="company-info">{company_address}</div>
                        <div class="company-info">GSTIN: {company_gstin}</div>
                    </td>
                    <td style="width:25%; text-align:right; vertical-align:top;">
                        <div class="payslip-badge-box">PAYSLIP</div>
                        <div class="month-year">{month_name} {year}</div>
                    </td>
                </tr>
            </table>

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
            </table>

            <table class="comp-layout">
                <tr>
                    <td class="comp-cell">
                        <div class="comp-box">
                            <div class="box-hdr earn">EARNINGS <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                {earn_rows or "<tr><td colspan='2' style='text-align:center;'>-</td></tr>"}
                                <tr class="total-row"><td>GROSS EARNINGS</td><td style="text-align:right;">Rs. {total_earnings:,.2f}</td></tr>
                            </table>
                        </div>
                    </td>
                    <td class="comp-spacer"></td>
                    <td class="comp-cell">
                        <div class="comp-box">
                            <div class="box-hdr ded">DEDUCTIONS <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                {ded_rows or "<tr><td colspan='2' style='text-align:center;'>-</td></tr>"}
                                <tr class="total-row"><td>TOTAL DEDUCTIONS</td><td style="text-align:right;">Rs. {total_deductions:,.2f}</td></tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <table class="comp-layout">
                <tr>
                    <td class="comp-cell">
                        <div class="comp-box">
                            <div class="box-hdr cont">EMPLOYER CONTRIBUTIONS <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                {cont_rows or "<tr><td colspan='2' style='text-align:center;'>-</td></tr>"}
                                <tr class="total-row"><td>TOTAL CONTRIBUTIONS</td><td style="text-align:right;">Rs. {total_employer_cont:,.2f}</td></tr>
                            </table>
                        </div>
                    </td>
                    <td class="comp-spacer"></td>
                    <td class="comp-cell">
                        <div class="comp-box">
                            <div class="box-hdr summ">CTC SUMMARY <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                <tr><td>Gross Salary</td><td style="text-align:right;">{total_earnings:,.2f}</td></tr>
                                <tr><td>Employer Contributions</td><td style="text-align:right;">{total_employer_cont:,.2f}</td></tr>
                                <tr class="total-row"><td>MONTHLY CTC</td><td style="text-align:right;">Rs. {monthly_ctc:,.2f}</td></tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="section-title">Attendance & Leave Summary</div>
            <table class="leave-tbl">
                <tr>
                    <th style="text-align:left;">Leave Type</th>
                    <th>Opening</th>
                    <th>Earned</th>
                    <th>Utilized</th>
                    <th style="text-align:right;">Closing Balance</th>
                </tr>
                {leave_rows}
            </table>

            <div class="net-box">
                <div class="net-title">Total In-Hand Salary (Net Pay)</div>
                <div class="net-val">Rs. {net_salary:,.2f}</div>
                <div class="net-words">({net_words})</div>
            </div>
            
            <div class="footer-note">
                {footer_text}<br>
                Generated on {calendar.monthrange(year, record.month)[1]}-{month_name[:3]}-{year}
            </div>
        </div>
    </body></html>
    """
    return html
