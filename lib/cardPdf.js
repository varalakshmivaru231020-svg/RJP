const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PHOTO_DIR } = require('./upload');
const { getSetting } = require('./settings');

const NAVY = '#16234A';
const GREEN = '#1B7A3D';
const WHITE = '#FFFFFF';

async function streamCardPdf(res, member, qrBuffer) {
  const accent = (await getSetting('primary_color')) || '#F0A400';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="RJP-Membership-${member.application_number}.pdf"`);

  const doc = new PDFDocument({ size: [340, 220], margin: 0 });
  doc.pipe(res);

  doc.rect(0, 0, 340, 220).fill(NAVY);
  doc.rect(0, 0, 340, 6).fill(accent);

  doc.fillColor(WHITE).fontSize(13).font('Helvetica-Bold')
    .text('Rashtriya Janahita Party', 20, 22, { width: 220 });
  doc.fontSize(8).font('Helvetica').fillColor('#c3cde3')
    .text('Digital Membership Card', 20, 40);

  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 290, 16, { width: 34, height: 34 }); } catch (e) { /* ignore */ }
  }

  const photoPath = member.photo_path ? path.join(PHOTO_DIR, member.photo_path) : null;
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      doc.save();
      doc.rect(20, 66, 70, 70).stroke(accent);
      doc.image(photoPath, 21, 67, { width: 68, height: 68, fit: [68, 68] });
      doc.restore();
    } catch (e) { /* ignore malformed image */ }
  } else {
    doc.rect(20, 66, 70, 70).fill('#22315c');
    doc.fillColor('#8b93a5').fontSize(8).text('No Photo', 20, 96, { width: 70, align: 'center' });
  }

  doc.fillColor(WHITE).fontSize(14).font('Helvetica-Bold').text(member.full_name, 104, 68, { width: 160 });
  doc.fontSize(9).font('Helvetica').fillColor('#c3cde3')
    .text(`Membership ID: ${member.application_number}`, 104, 90)
    .text(`District: ${member.district || '-'}`, 104, 106)
    .text(`Assembly: ${member.assembly || '-'}`, 104, 122)
    .fillColor(GREEN === '#1B7A3D' ? '#3fd67a' : GREEN)
    .text(`Status: ${member.status}`, 104, 138);

  if (qrBuffer) {
    doc.rect(266, 140, 58, 58).fill(WHITE);
    try { doc.image(qrBuffer, 270, 144, { width: 50, height: 50 }); } catch (e) { /* ignore */ }
  }

  doc.moveTo(20, 198).lineTo(320, 198).strokeColor('#3a4776').stroke();
  doc.fontSize(7).fillColor('#9fb0d0')
    .text('Reg. No. 56/283/2019-2020/PPS-1', 20, 204)
    .text('rjpindia.com', 260, 204);

  doc.end();
}

module.exports = { streamCardPdf };
