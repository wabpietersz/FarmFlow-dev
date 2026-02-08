import jsPDF from 'jspdf';

interface InvoiceData {
  saleCode: string;
  saleDate: string;
  buyer: {
    buyerName: string;
    contactPerson?: string;
    phoneNumber?: string;
    address?: string;
  };
  batchCode: string;
  siteName: string;
  totalBirds: number;
  pricePerBird: number;
  totalAmount: number;
  payments: {
    paymentDate: string;
    paymentAmount: number;
    paymentMethod: string;
    paymentStatus: string;
  }[];
  totalPaid: number;
  outstandingBalance: number;
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // --- Company Header ---
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('FarmFlow', 14, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Poultry Farm Management', 14, y + 7);

  // Invoice title — right aligned
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - 14, y, { align: 'right' });

  y += 20;

  // --- Invoice Details ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Left column: buyer info
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(data.buyer.buyerName, 14, y);
  if (data.buyer.contactPerson) {
    y += 5;
    doc.text(`Attn: ${data.buyer.contactPerson}`, 14, y);
  }
  if (data.buyer.phoneNumber) {
    y += 5;
    doc.text(`Tel: ${data.buyer.phoneNumber}`, 14, y);
  }
  if (data.buyer.address) {
    y += 5;
    const addressLines = doc.splitTextToSize(data.buyer.address, 80);
    doc.text(addressLines, 14, y);
    y += (addressLines.length - 1) * 5;
  }

  // Right column: invoice meta
  const metaX = pageWidth - 14;
  let metaY = 40;
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice #:', metaX - 60, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.saleCode, metaX, metaY, { align: 'right' });

  metaY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', metaX - 60, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(data.saleDate).toLocaleDateString(), metaX, metaY, { align: 'right' });

  metaY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Batch:', metaX - 60, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.batchCode, metaX, metaY, { align: 'right' });

  metaY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Site:', metaX - 60, metaY);
  doc.setFont('helvetica', 'normal');
  doc.text(data.siteName || '--', metaX, metaY, { align: 'right' });

  y = Math.max(y, metaY) + 15;

  // --- Line separator ---
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pageWidth - 14, y);
  y += 8;

  // --- Line Items Table Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
  doc.text('Description', 16, y);
  doc.text('Qty', 100, y, { align: 'right' });
  doc.text('Unit Price', 140, y, { align: 'right' });
  doc.text('Amount', pageWidth - 16, y, { align: 'right' });
  y += 8;

  // --- Line Item ---
  doc.setFont('helvetica', 'normal');
  doc.text(`Broiler chickens (${data.batchCode})`, 16, y);
  doc.text(data.totalBirds.toLocaleString(), 100, y, { align: 'right' });
  doc.text(`R${data.pricePerBird.toFixed(2)}`, 140, y, { align: 'right' });
  doc.text(`R${data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 16, y, { align: 'right' });
  y += 8;

  // --- Separator ---
  doc.line(14, y, pageWidth - 14, y);
  y += 6;

  // --- Total ---
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 140, y, { align: 'right' });
  doc.text(`R${data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 16, y, { align: 'right' });
  y += 12;

  // --- Payments Section ---
  if (data.payments.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Payments', 14, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFillColor(245, 245, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, 'F');
    doc.text('Date', 16, y);
    doc.text('Method', 70, y);
    doc.text('Status', 120, y);
    doc.text('Amount', pageWidth - 16, y, { align: 'right' });
    y += 8;

    doc.setFont('helvetica', 'normal');
    for (const payment of data.payments) {
      doc.text(new Date(payment.paymentDate).toLocaleDateString(), 16, y);
      const methodLabel =
        payment.paymentMethod === 'bank_transfer'
          ? 'Bank Transfer'
          : payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1);
      doc.text(methodLabel, 70, y);
      doc.text(payment.paymentStatus.charAt(0).toUpperCase() + payment.paymentStatus.slice(1), 120, y);
      doc.text(
        `R${payment.paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        pageWidth - 16,
        y,
        { align: 'right' },
      );
      y += 6;
    }

    y += 4;
    doc.line(14, y, pageWidth - 14, y);
    y += 6;

    // Payment summary
    doc.setFont('helvetica', 'normal');
    doc.text('Total Paid:', 140, y, { align: 'right' });
    doc.text(`R${data.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 16, y, { align: 'right' });
    y += 6;

    doc.setFont('helvetica', 'bold');
    if (data.outstandingBalance > 0) {
      doc.setTextColor(220, 50, 50);
    } else {
      doc.setTextColor(34, 139, 34);
    }
    doc.text('Outstanding:', 140, y, { align: 'right' });
    doc.text(`R${data.outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, pageWidth - 16, y, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('Generated by FarmFlow', 14, footerY);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth - 14, footerY, { align: 'right' });

  // Save
  doc.save(`${data.saleCode}-invoice.pdf`);
}
