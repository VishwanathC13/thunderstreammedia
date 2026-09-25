const PDFDocument = require('pdfkit');

// Renders straight to an in-memory buffer instead of a disk file + DB
// pointer — sidesteps the write-stream "finish" race entirely and lets
// the PDF be regenerated on demand from the Quote+lineItems in the DB
// (used by both the download route and email attachments).
function generateQuotePdfBuffer(quote) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#F0362A').fontSize(22).text('Thunderstream Media', { align: 'left' });
    doc.fillColor('#8C8992').fontSize(10).text('Quotation', { align: 'left' });
    doc.moveDown(1.5);

    doc.fillColor('#111').fontSize(11);
    doc.text(`Quote #${quote.id}`);
    doc.text(`Client: ${quote.client?.name || ''}`);
    doc.text(`Contact: ${quote.client?.contact || ''}`);
    doc.text(`Date: ${new Date(quote.createdAt).toDateString()}`);
    doc.moveDown();

    doc.fontSize(12).fillColor('#111').text('Line items', { underline: true });
    doc.moveDown(0.5);
    for (const item of quote.lineItems || []) {
      doc.fontSize(10).fillColor('#111').text(
        `${item.label}   x${item.qty}   Rs. ${item.unitPrice.toLocaleString('en-IN')}   =   Rs. ${item.lineTotal.toLocaleString('en-IN')}`
      );
    }
    doc.moveDown();
    doc.fontSize(12).fillColor('#111').text(`Subtotal: Rs. ${quote.subtotal.toLocaleString('en-IN')}`, { align: 'right' });
    doc.fontSize(14).fillColor('#F0362A').text(`Total: Rs. ${quote.total.toLocaleString('en-IN')}`, { align: 'right' });

    if (quote.note) {
      doc.moveDown();
      doc.fontSize(10).fillColor('#8C8992').text(`Note: ${quote.note}`);
    }

    doc.end();
  });
}

module.exports = { generateQuotePdfBuffer };
