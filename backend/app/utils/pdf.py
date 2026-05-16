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
    
    logo_html = f'<img src="{company_logo}" style="height:40px;" />' if company_logo else f'<div style="font-size:16pt; font-weight:bold; color:#1a3c5e;">{company_name}</div>'

    css = """
    @page { size: A4; margin: 1cm; }
    body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 9pt; color: #333; line-height: 1.4; }
    .container { width: 100%; }
    
    /* Header */
    .hdr-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .hdr-table td { vertical-align: middle; }
    .company-title { font-size: 15pt; font-weight: bold; color: #000; line-height: 1.2; }
    .company-addr { font-size: 8pt; color: #666; margin-top: 2px; }
    .slip-badge { background: #1e3a8a; color: #fff; padding: 4px 12px; font-weight: bold; border-radius: 2px; display: inline-block; }
    
    /* Info Grid */
    .info-grid { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .info-grid td { padding: 4px 2px; vertical-align: middle; }
    .lbl { color: #6b7280; width: 18%; }
    .sep { width: 2%; text-align: center; color: #9ca3af; }
    .val { font-weight: bold; width: 30%; color: #111; }
    
    /* Section Headers */
    .section-hdr { background: #eff6ff; padding: 5px 10px; font-weight: bold; font-size: 8.5pt; color: #1e40af; border-radius: 3px; margin-bottom: 8px; }
    
    /* Column Tables (xhtml2pdf reliable side-by-side) */
    .col-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .col-table td.col-cell { width: 49%; vertical-align: top; padding: 0; }
    .col-table td.col-spacer { width: 2%; }
    
    .comp-box { border: 1px solid #f3f4f6; border-radius: 4px; overflow: hidden; }
    .box-hdr { padding: 5px 10px; font-weight: bold; font-size: 8pt; }
    .box-hdr.earn { background: #dcfce7; color: #166534; }
    .box-hdr.ded { background: #fee2e2; color: #991b1b; }
    .box-hdr.cont { background: #f3e8ff; color: #6b21a8; }
    .box-hdr.summ { background: #ffedd5; color: #9a3412; }
    
    .comp-tbl { width: 100%; border-collapse: collapse; }
    .comp-tbl td { padding: 5px 10px; border-bottom: 1px solid #f9fafb; font-size: 8.5pt; }
    .comp-tbl .total-row { font-weight: bold; background: #fafafa; border-top: 1px solid #eee; }
    
    /* Leave Details */
    .leave-tbl { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .leave-tbl th { background: #f8fafc; color: #64748b; font-size: 8pt; padding: 5px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    .leave-tbl td { padding: 5px; border-bottom: 1px solid #f1f5f9; text-align: center; }
    
    /* Net Pay */
    .net-box { background: #1e3a8a; color: #fff; padding: 15px; border-radius: 4px; margin-top: 15px; }
    .net-amt { font-size: 16pt; font-weight: bold; margin-bottom: 4px; }
    .net-words { font-size: 8.5pt; opacity: 0.9; font-weight: bold; }
    """

    earn_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.0f}</td></tr>" for k, v in earnings.items()])
    ded_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.0f}</td></tr>" for k, v in deductions.items()])
    cont_rows = "".join([f"<tr><td>{k}</td><td style='text-align:right;'>{float(v):,.0f}</td></tr>" for k, v in employer_cont.items()])

    # Leave Data
    leave_rows = ""
    if hasattr(employee, 'leave_balances') and employee.leave_balances:
        for bal in employee.leave_balances:
            leave_rows += f"<tr><td style='text-align:left;'>{bal.leave_type.name}</td><td>{bal.allocated_days}</td><td>{bal.used_days}</td><td>0</td><td>{bal.allocated_days - bal.used_days}</td></tr>"
    else:
        for lt in ["Casual Leave (CL)", "Sick Leave (SL)", "Earned Leave (EL)"]:
             leave_rows += f"<tr><td style='text-align:left;'>{lt}</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>"

    html = f"""
    <html>
    <head><meta charset="utf-8"/><style>{css}</style></head>
    <body>
        <div class="container">
            <table class="hdr-table">
                <tr>
                    <td style="width:70px;">{logo_html}</td>
                    <td style="padding-left:15px;">
                        <div class="company-title">{company_name}</div>
                        <div class="company-addr">{company_address}</div>
                    </td>
                    <td style="text-align:right;">
                        <span class="slip-badge">PAYSLIP</span>
                        <div style="font-weight:bold; font-size:11pt; margin-top:6px;">{month_name} {year}</div>
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

            <table class="col-table">
                <tr>
                    <td class="col-cell">
                        <div class="comp-box">
                            <div class="box-hdr earn">EARNINGS <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                {earn_rows or "<tr><td colspan='2'>-</td></tr>"}
                                <tr class="total-row"><td>GROSS EARNINGS</td><td style="text-align:right;">Rs. {total_earnings:,.0f}</td></tr>
                            </table>
                        </div>
                    </td>
                    <td class="col-spacer"></td>
                    <td class="col-cell">
                        <div class="comp-box">
                            <div class="box-hdr ded">DEDUCTIONS <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                {ded_rows or "<tr><td colspan='2'>-</td></tr>"}
                                <tr class="total-row"><td>TOTAL DEDUCTIONS</td><td style="text-align:right;">Rs. {total_deductions:,.0f}</td></tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <table class="col-table">
                <tr>
                    <td class="col-cell">
                        <div class="comp-box">
                            <div class="box-hdr cont">EMPLOYER CONTRIBUTIONS <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                {cont_rows or "<tr><td colspan='2'>-</td></tr>"}
                                <tr class="total-row"><td>TOTAL CONTRIBUTIONS</td><td style="text-align:right;">Rs. {total_employer_cont:,.0f}</td></tr>
                            </table>
                        </div>
                    </td>
                    <td class="col-spacer"></td>
                    <td class="col-cell">
                        <div class="comp-box">
                            <div class="box-hdr summ">CTC SUMMARY <span style="float:right">Amount (Rs.)</span></div>
                            <table class="comp-tbl">
                                <tr><td>Gross Salary</td><td style="text-align:right;">{total_earnings:,.0f}</td></tr>
                                <tr><td>Employer Contributions</td><td style="text-align:right;">{total_employer_cont:,.0f}</td></tr>
                                <tr class="total-row"><td>MONTHLY CTC</td><td style="text-align:right;">Rs. {monthly_ctc:,.0f}</td></tr>
                            </table>
                        </div>
                    </td>
                </tr>
            </table>

            <div class="section-hdr">Leave Details</div>
            <table class="leave-tbl">
                <tr>
                    <th style="text-align:left;">Leave Type</th>
                    <th>Opening</th>
                    <th>Earned</th>
                    <th>Utilized</th>
                    <th style="text-align:right;">Closing</th>
                </tr>
                {leave_rows}
            </table>

            <div class="net-box">
                <div style="font-weight:bold; font-size:10pt; margin-bottom:5px;">NET PAY (In-Hand Salary)</div>
                <div class="net-amt">Rs. {net_salary:,.0f}</div>
                <div class="net-words">({net_words})</div>
            </div>
            
            <div style="text-align:center; font-size:8pt; color:#999; margin-top:25px;">{footer_text}</div>
        </div>
    </body></html>
    """
    return html
