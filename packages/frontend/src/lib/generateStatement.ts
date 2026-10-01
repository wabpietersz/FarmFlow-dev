import jsPDF from 'jspdf';
import type { BuyerStatement } from '@farmflow/shared';

const money = (value: number) => `Rs. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (value: string) => new Date(value).toLocaleDateString();

/** Buyer statement PDF in the same style as the sale invoice. */
export function generateStatementPDF(statement: BuyerStatement) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const right = pageWidth - 14;
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FarmFlow', 14, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Poultry Farm Management', 14, y + 7);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('STATEMENT', right, y, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${day(statement.from)} – ${day(statement.to)}`, right, y + 7, { align: 'right' });

  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.text(statement.buyer.buyerName, 14, y);
  doc.setFont('helvetica', 'normal');
  if (statement.buyer.contactPerson) { y += 5; doc.text(`Attn: ${statement.buyer.contactPerson}`, 14, y); }
  if (statement.buyer.phoneNumber) { y += 5; doc.text(`Tel: ${statement.buyer.phoneNumber}`, 14, y); }
  if (statement.buyer.address) {
    y += 5;
    const lines = doc.splitTextToSize(statement.buyer.address, 90);
    doc.text(lines, 14, y);
    y += (lines.length - 1) * 5;
  }
  doc.text(`Terms: ${statement.buyer.creditTerms ? `${statement.buyer.creditTerms} days` : 'On delivery'}`, right, 42, { align: 'right' });

  y += 12;
  const header = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
    doc.text('Date', 16, y);
    doc.text('Reference', 40, y);
    doc.text('Details', 78, y);
    doc.text('Charged', 140, y, { align: 'right' });
    doc.text('Paid', 168, y, { align: 'right' });
    doc.text('Balance', right - 2, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 8;
  };
  header();

  doc.text(day(statement.from), 16, y);
  doc.text('Opening balance', 78, y);
  doc.text(money(statement.openingBalance), right - 2, y, { align: 'right' });
  y += 7;

  for (const entry of statement.entries) {
    if (y > pageHeight - 40) { doc.addPage(); y = 20; header(); }
    doc.text(day(entry.entryDate), 16, y);
    doc.text(entry.referenceCode, 40, y);
    const details = entry.entryType === 'receipt' && entry.credit === 0 ? `${entry.description} (${entry.status})` : entry.description;
    doc.text(doc.splitTextToSize(details, 40)[0], 78, y);
    if (entry.debit) doc.text(money(entry.debit), 140, y, { align: 'right' });
    if (entry.credit) doc.text(money(entry.credit), 168, y, { align: 'right' });
    doc.text(money(entry.runningBalance), right - 2, y, { align: 'right' });
    y += 7;
  }

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, right, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Balance due', 120, y);
  doc.text(money(statement.closingBalance), right - 2, y, { align: 'right' });

  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const a = statement.ageing;
  doc.text(
    `Not yet due ${money(a.current)}   ·   1–30 days ${money(a.days1to30)}   ·   31–60 ${money(a.days31to60)}   ·   61–90 ${money(a.days61to90)}   ·   90+ ${money(a.over90)}`,
    14, y,
  );

  doc.save(`Statement-${statement.buyer.buyerName.replace(/[^\w-]+/g, '_')}-${statement.to}.pdf`);
}
