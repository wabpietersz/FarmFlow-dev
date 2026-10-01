import jsPDF from 'jspdf';
import type { PayrollRegisterRow } from '@farmflow/shared';

const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (period: string) => new Date(`${period.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

/** One payslip per page. Pass one row for a single payslip, or the whole register for the month. */
export function generatePayslipsPDF(period: string, rows: PayrollRegisterRow[]) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - 14;
  const mid = pageWidth / 2 + 4;

  rows.forEach((row, index) => {
    if (index > 0) doc.addPage();
    let y = 20;
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('FarmFlow', 14, y);
    doc.setFontSize(16);
    doc.text('PAYSLIP', right, y, { align: 'right' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(monthLabel(period), right, y + 7, { align: 'right' });

    y += 20;
    const info: Array<[string, string]> = [
      ['Employee', row.employeeName],
      ['Designation', row.designation],
      ['Farm', row.siteName ?? '--'],
      ['EPF No.', row.epfNumber ?? '--'],
      ['Days worked', `${row.attendedDays} of ${row.workingDays}`],
    ];
    info.forEach(([label, value], i) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 14, y + i * 6);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 50, y + i * 6);
    });
    y += info.length * 6 + 8;

    // Two columns: earnings | deductions
    const earnings: Array<[string, number]> = [
      ['Basic salary', row.basicEarned],
      ...(row.overtimePay > 0 ? [[`Overtime (${row.overtimeHours} h)`, row.overtimePay] as [string, number]] : []),
      ...row.allowances.map((a) => [a.name, a.amount] as [string, number]),
    ];
    const rate = row.statutoryRates?.epfEmployeeRate ?? 8;
    const deductions: Array<[string, number]> = [
      ...(row.epfEmployee > 0 ? [[`EPF (${rate}%)`, row.epfEmployee] as [string, number]] : []),
      ...row.deductions.map((d) => [d.name, d.amount] as [string, number]),
      ...row.loanRecoveries.map((l) => [l.name, l.amount] as [string, number]),
    ];

    doc.setFillColor(245, 245, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Earnings', 16, y);
    doc.text('Rs.', mid - 6, y, { align: 'right' });
    doc.text('Deductions', mid, y);
    doc.text('Rs.', right - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 8;
    const lines = Math.max(earnings.length, deductions.length, 1);
    for (let i = 0; i < lines; i += 1) {
      if (earnings[i]) {
        doc.text(doc.splitTextToSize(earnings[i][0], mid - 40)[0], 16, y);
        doc.text(money(earnings[i][1]), mid - 6, y, { align: 'right' });
      }
      if (deductions[i]) {
        doc.text(doc.splitTextToSize(deductions[i][0], right - mid - 30)[0], mid, y);
        doc.text(money(deductions[i][1]), right - 2, y, { align: 'right' });
      }
      y += 6;
    }
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, right, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Gross pay', 16, y);
    doc.text(money(row.grossSalary), mid - 6, y, { align: 'right' });
    doc.text('Total deductions', mid, y);
    doc.text(money(row.epfEmployee + row.otherDeductions + row.loanRecovery), right - 2, y, { align: 'right' });

    y += 12;
    doc.setFillColor(29, 85, 176);
    doc.rect(14, y - 6, pageWidth - 28, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('NET PAY', 18, y + 1);
    doc.text(`Rs. ${money(row.netSalary)}`, right - 4, y + 1, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    y += 16;
    if (row.epfBase > 0) {
      doc.text(`Employer contributions (not deducted): EPF ${row.statutoryRates?.epfEmployerRate ?? 12}% Rs. ${money(row.epfEmployer)} · ETF ${row.statutoryRates?.etfEmployerRate ?? 3}% Rs. ${money(row.etfEmployer)} · on earnings of Rs. ${money(row.epfBase)}`, 14, y);
      y += 6;
    }
    if (row.accountNumber) {
      doc.text(`Paid to ${row.bankName ?? 'bank'} ${row.branchCode ? `(${row.branchCode}) ` : ''}account ${row.accountNumber}${row.paidDate ? ` on ${new Date(row.paidDate).toLocaleDateString()}` : ''}`, 14, y);
    } else if (row.paidDate) {
      doc.text(`Paid ${row.paymentMethod === 'cash' ? 'in cash' : ''} on ${new Date(row.paidDate).toLocaleDateString()}`, 14, y);
    }
  });

  const name = rows.length === 1 ? `Payslip-${rows[0].employeeName.replace(/[^\w-]+/g, '_')}` : 'Payslips';
  doc.save(`${name}-${period.slice(0, 7)}.pdf`);
}

/** CSV text: values with commas, quotes or new lines are quoted, quotes doubled. */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [header, ...rows].map((line) => line.map(escape).join(',')).join('\r\n');
}

/** CSV download helper (Excel-friendly: UTF-8 with BOM so Sinhala/Tamil names open correctly). */
export function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const url = URL.createObjectURL(new Blob(['\uFEFF', toCsv(header, rows)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
