const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PHOTO_DIR } = require('./upload');

const NAVY = '#16234A';
const GREEN = '#1B7A3D';
const GREEN_DEEP = '#0B3D22';
const GOLD = '#F0A400';
const CREAM = '#FBF6EA';
const WHITE = '#FFFFFF';

const W = 340;
const H = 520;

const KN_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKannada-Regular.ttf');
const KN_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKannada-Bold.ttf');

// The Kannada font is a script-only subset (no Latin letters/digits/most
// punctuation), so any string that might mix Kannada and Latin/numeric
// characters (e.g. a member's name, or a tagline with "...") has to be
// split into per-script runs and rendered with the matching font per run.
function isKannadaChar(ch) {
  const cp = ch.codePointAt(0);
  return cp >= 0x0C80 && cp <= 0x0CFF;
}

function splitRuns(text) {
  const runs = [];
  let current = '';
  let currentKannada = null;
  for (const ch of String(text)) {
    const kn = isKannadaChar(ch);
    if (currentKannada === null) {
      currentKannada = kn;
      current = ch;
    } else if (kn === currentKannada) {
      current += ch;
    } else {
      runs.push({ text: current, kannada: currentKannada });
      current = ch;
      currentKannada = kn;
    }
  }
  if (current) runs.push({ text: current, kannada: currentKannada });
  return runs;
}

function mixedText(doc, text, x, y, opts) {
  const { kannadaFont, latinFont, fontSize, color } = opts;
  doc.fontSize(fontSize).fillColor(color);
  const runs = splitRuns(text);
  runs.forEach((run, i) => {
    doc.font(run.kannada ? kannadaFont : latinFont);
    if (i === 0) doc.text(run.text, x, y, { continued: i < runs.length - 1 });
    else doc.text(run.text, { continued: i < runs.length - 1 });
  });
}

function mixedTextWidth(doc, text, opts) {
  const { kannadaFont, latinFont, fontSize } = opts;
  doc.fontSize(fontSize);
  return splitRuns(text).reduce((sum, run) => {
    doc.font(run.kannada ? kannadaFont : latinFont);
    return sum + doc.widthOfString(run.text);
  }, 0);
}

function centeredMixedText(doc, text, centerX, y, opts) {
  const w = mixedTextWidth(doc, text, opts);
  mixedText(doc, text, centerX - w / 2, y, opts);
}

// Drawn as vector strokes rather than a "✓" glyph — PDFKit's standard
// Helvetica encoding doesn't map that Unicode codepoint reliably.
function drawCheckmark(doc, cx, cy, size, color) {
  doc.save();
  doc.strokeColor(color).lineWidth(size * 0.18).lineCap('round').lineJoin('round');
  doc.moveTo(cx - size * 0.5, cy)
    .lineTo(cx - size * 0.12, cy + size * 0.38)
    .lineTo(cx + size * 0.5, cy - size * 0.35)
    .stroke();
  doc.restore();
}

async function streamCardPdf(res, member, qrBuffer) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="RJP-Membership-${member.application_number}.pdf"`);

  const doc = new PDFDocument({ size: [W, H], margin: 0 });
  doc.registerFont('KN-Regular', KN_REGULAR);
  doc.registerFont('KN-Bold', KN_BOLD);
  doc.pipe(res);

  drawFront(doc, member);
  doc.addPage({ size: [W, H], margin: 0 });
  drawBack(doc, member, qrBuffer);

  doc.end();
}

function drawFront(doc, member) {
  doc.rect(0, 0, W, H).fill(WHITE);

  const headerGrad = doc.linearGradient(0, 0, W, 150);
  headerGrad.stop(0, '#FBDD86').stop(0.45, GOLD).stop(1, GREEN);
  doc.rect(0, 0, W, 150).fill(headerGrad);

  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  doc.circle(W / 2, 42, 28).fill(WHITE);
  if (fs.existsSync(logoPath)) {
    try {
      doc.save();
      doc.circle(W / 2, 42, 25).clip();
      doc.image(logoPath, W / 2 - 25, 17, { width: 50, height: 50 });
      doc.restore();
    } catch (e) { /* ignore malformed image */ }
  }

  centeredMixedText(doc, 'RJP', W / 2, 76, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 19, color: NAVY });
  centeredMixedText(doc, 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ', W / 2, 99, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 12, color: NAVY });
  centeredMixedText(doc, 'RASHTRIYA JANAHITA PARTY', W / 2, 118, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 7, color: '#5a3d00' });
  centeredMixedText(doc, 'ಜನ ಮೊದಲು ಅಧಿಕಾರ ನಂತರ', W / 2, 130, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 7, color: NAVY });

  doc.roundedRect(W / 2 - 92, 142, 184, 24, 12).fill(GREEN);
  centeredMixedText(doc, 'DIGITAL MEMBERSHIP CARD', W / 2, 149, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 8.5, color: WHITE });

  const photoPath = member.photo_path ? path.join(PHOTO_DIR, member.photo_path) : null;
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      doc.save();
      doc.roundedRect(24, 188, 84, 100, 8).clip();
      doc.image(photoPath, 24, 188, { width: 84, height: 100 });
      doc.restore();
      doc.roundedRect(24, 188, 84, 100, 8).lineWidth(2.5).stroke(GOLD);
    } catch (e) { /* ignore malformed image */ }
  } else {
    doc.roundedRect(24, 188, 84, 100, 8).fill('#eef0f5');
    doc.fillColor('#9aa3b5').font('Helvetica').fontSize(8).text('No Photo', 24, 233, { width: 84, align: 'center' });
  }

  const fields = [
    ['ಹೆಸರು', member.full_name],
    ['ID', member.application_number],
    ['ಜಿಲ್ಲೆ', member.district || '-'],
    ['ಕ್ಷೇತ್ರ', member.assembly || '-'],
    ['ದಿನಾಂಕ', (member.created_at || '').split(' ')[0]]
  ];
  let fy = 192;
  const fx = 120;
  fields.forEach(([label, value]) => {
    mixedText(doc, label, fx, fy, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 8, color: '#6b7280' });
    mixedText(doc, String(value), fx, fy + 11, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 9.5, color: NAVY });
    fy += 30;
  });

  doc.moveTo(40, 418).lineTo(150, 418).strokeColor('#c7cbd6').stroke();
  doc.fillColor('#6b7280').font('Helvetica').fontSize(7).text('Authorised Signatory', 40, 422, { width: 110, align: 'center' });

  doc.circle(W - 60, 408, 20).fill(GREEN);
  drawCheckmark(doc, W - 60, 408, 20, WHITE);

  doc.rect(0, H - 32, W, 32).fill(NAVY);
  doc.fillColor(WHITE).font('Helvetica').fontSize(7).text('rjpindia.com', 20, H - 20);
  doc.fillColor(WHITE).font('Helvetica').fontSize(7).text('Reg. No. 56/283/2019-2020/PPS-1', 0, H - 20, { width: W - 20, align: 'right' });
}

function drawBack(doc, member, qrBuffer) {
  doc.rect(0, 0, W, H).fill(WHITE);

  const headerGrad = doc.linearGradient(0, 0, W, 108);
  headerGrad.stop(0, GREEN).stop(1, GREEN_DEEP);
  doc.rect(0, 0, W, 108).fill(headerGrad);

  centeredMixedText(doc, 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP)', W / 2, 26, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 11.5, color: WHITE });
  centeredMixedText(doc, 'RASHTRIYA JANAHITA PARTY', W / 2, 46, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 7.5, color: '#dff3e6' });
  centeredMixedText(doc, 'ಜನ ಮೊದಲು ಅಧಿಕಾರ ನಂತರ', W / 2, 64, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 7, color: '#dff3e6' });

  const points = [
    'ಜನರೊಂದಿಗೆ ಜನರಿಗಾಗಿ ಜನಹಿತಕ್ಕಾಗಿ',
    'ಪಾರದರ್ಶಕತೆ ನಮ್ಮ ಬದ್ಧತೆ',
    'ನ್ಯಾಯ ಸಮಾನತೆ ಅಭಿವೃದ್ಧಿ ನಮ್ಮ ಗುರಿ',
    'ಸೇವೆ ನಮ್ಮ ಧರ್ಮ',
    'ಸಮೃದ್ಧ ಭಾರತ ನಮ್ಮ ಕನಸು'
  ];
  let y = 128;
  points.forEach((p) => {
    doc.circle(34, y + 6, 9).fill(CREAM);
    mixedText(doc, p, 54, y, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 8, color: NAVY });
    y += 26;
  });

  if (qrBuffer) {
    doc.roundedRect(24, y + 4, 64, 64, 6).lineWidth(1).stroke('#e5e7eb');
    try { doc.image(qrBuffer, 27, y + 7, { width: 58, height: 58 }); } catch (e) { /* ignore */ }
    mixedText(doc, 'ನಿಮ್ಮ ಸದಸ್ಯತ್ವವನ್ನು', 98, y + 14, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 8, color: NAVY });
    mixedText(doc, 'ಪರಿಶೀಲಿಸಲು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', 98, y + 28, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 8, color: NAVY });
  }
  y += 86;

  const compliance = [
    'ಈ ಕಾರ್ಡ್ ಪಕ್ಷದ ಅಧಿಕೃತ ಸದಸ್ಯತ್ವದ ಆಧಾರ',
    'ಕಾರ್ಡ್ ವರ್ಗಾವಣೆ ಅಮಾನ್ಯ',
    'www.rjpindia.com ಗೆ ಭೇಟಿ ನೀಡಿ'
  ];
  compliance.forEach((c) => {
    drawCheckmark(doc, 26, y + 4, 12, GREEN);
    mixedText(doc, c, 34, y, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 7.5, color: '#3a4152' });
    y += 16;
  });

  doc.rect(0, H - 32, W, 32).fill(NAVY);
  doc.fillColor(WHITE).font('Helvetica').fontSize(7).text('Helpline: 1800 123 2024', 20, H - 20);
  doc.fillColor(WHITE).font('Helvetica').fontSize(7).text('info@rjpindia.com', 0, H - 20, { width: W - 20, align: 'right' });
}

module.exports = { streamCardPdf };
