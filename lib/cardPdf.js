const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { PHOTO_DIR } = require('./upload');

const BLUE = '#123D87';
const GREEN = '#0B6B33';
const GREEN_DEEP = '#08461F';
const GOLD = '#F4B400';
const GOLD_DEEP = '#C8850A';
const MUTED = '#6b7280';
const LINE = '#E2E5EC';
const WHITE = '#FFFFFF';
const CREAM = '#FBF6EA';

const W = 340;
const MARGIN = 20;
const GAP = 24;
const PAGE_W = W * 2 + GAP;

const KN_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKannada-Regular.ttf');
const KN_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKannada-Bold.ttf');

// The Kannada font is a script-only subset (no Latin letters/digits/most
// punctuation), so any string that might mix Kannada and Latin/numeric
// characters has to be split by script and rendered with the matching font.
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

// ---- Fixed, known-short strings (labels, headings, taglines) — single line, never wraps ----
function mixedText(doc, text, x, y, opts) {
  const { kannadaFont, latinFont, fontSize, color } = opts;
  doc.fontSize(fontSize).fillColor(color);
  const runs = splitRuns(text);
  runs.forEach((run, i) => {
    doc.font(run.kannada ? kannadaFont : latinFont);
    if (i === 0) doc.text(run.text, x, y, { continued: i < runs.length - 1, lineBreak: false });
    else doc.text(run.text, { continued: i < runs.length - 1, lineBreak: false });
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

function drawCheckmark(doc, cx, cy, size, color) {
  doc.save();
  doc.strokeColor(color).lineWidth(size * 0.18).lineCap('round').lineJoin('round');
  doc.moveTo(cx - size * 0.5, cy)
    .lineTo(cx - size * 0.12, cy + size * 0.38)
    .lineTo(cx + size * 0.5, cy - size * 0.35)
    .stroke();
  doc.restore();
}

// ---- Word-wrapped text for member-supplied values (names, places…) that can run long ----
// Each whitespace-delimited token is itself split into script runs (a Kannada word with a
// trailing "," or "." must not be drawn in the Kannada font — that subset has no punctuation
// glyphs and would render as a tofu box), so wrapping stays word-level while font selection
// stays character-accurate.
function tokenize(doc, text, opts) {
  const { kannadaFont, latinFont, fontSize } = opts;
  doc.fontSize(fontSize);
  return String(text).split(/\s+/).filter(Boolean).map((word) => {
    const runs = splitRuns(word).map((run) => {
      doc.font(run.kannada ? kannadaFont : latinFont);
      return { text: run.text, kannada: run.kannada, w: doc.widthOfString(run.text) };
    });
    return { runs, w: runs.reduce((s, r) => s + r.w, 0) };
  });
}

function wrapWords(doc, text, maxWidth, opts) {
  const words = tokenize(doc, text, opts);
  if (!words.length) return [[]];
  doc.font(opts.latinFont).fontSize(opts.fontSize);
  const spaceWidth = doc.widthOfString(' ');
  const lines = [];
  let current = [];
  let currentWidth = 0;
  words.forEach((token) => {
    const addWidth = current.length ? spaceWidth + token.w : token.w;
    if (current.length && currentWidth + addWidth > maxWidth) {
      lines.push(current);
      current = [token];
      currentWidth = token.w;
    } else {
      current.push(token);
      currentWidth += addWidth;
    }
  });
  if (current.length) lines.push(current);
  return lines.length ? lines : [[]];
}

function wrappedHeight(doc, text, maxWidth, opts) {
  return wrapWords(doc, text, maxWidth, opts).length * opts.lineHeight;
}

function drawWrapped(doc, text, x, y, maxWidth, opts) {
  const { kannadaFont, latinFont, fontSize, color, lineHeight } = opts;
  const lines = wrapWords(doc, text, maxWidth, opts);
  doc.font(latinFont).fontSize(fontSize);
  const spaceWidth = doc.widthOfString(' ');
  doc.fillColor(color);
  lines.forEach((line, li) => {
    let cx = x;
    const ly = y + li * lineHeight;
    line.forEach((token) => {
      token.runs.forEach((run) => {
        doc.font(run.kannada ? kannadaFont : latinFont).fontSize(fontSize).fillColor(color);
        doc.text(run.text, cx, ly, { lineBreak: false });
        cx += run.w;
      });
      cx += spaceWidth;
    });
  });
  return lines.length * lineHeight;
}

// ---- Layout constants (premium gold/green party-seal style, matches printed reference) ----
const FRONT = {
  headerH: 112, badgeH: 24, bodyTop: 20,
  photoW: 78, photoH: 96, fieldsGap: 14,
  labelSize: 6.5, valueSize: 9.5, valueLineH: 11.5, labelGap: 3, rowPad: 8,
  sectionGap: 16, signRowH: 58, waveH: 5, footerH: 24
};
FRONT.fieldsX = MARGIN + FRONT.photoW + FRONT.fieldsGap;
FRONT.fieldsW = W - MARGIN - FRONT.fieldsX;

const BACK = {
  headerH: 64, sectionGap: 14,
  benefitSize: 7.5, benefitLineH: 10, benefitGap: 8,
  qrBox: 54, qrKnSize: 7.5, qrKnLineH: 10, qrEnSize: 6.5,
  termSize: 7, termLineH: 9.5, termGap: 5,
  footerH: 32
};
BACK.benefitsTextX = MARGIN + 12;
BACK.benefitsW = W - BACK.benefitsTextX - MARGIN;
BACK.qrTextX = MARGIN + BACK.qrBox + 14;
BACK.qrTextW = W - BACK.qrTextX - MARGIN;
BACK.termsTextX = MARGIN + 10;
BACK.termsW = W - BACK.termsTextX - MARGIN;

const BENEFITS = [
  'ಜನರೊಂದಿಗೆ ಜನರಿಗಾಗಿ ಜನಹಿತಕ್ಕಾಗಿ',
  'ಪಾರದರ್ಶಕತೆ ನಮ್ಮ ಬದ್ಧತೆ',
  'ನ್ಯಾಯ, ಸಮಾನತೆ, ಅಭಿವೃದ್ಧಿ ನಮ್ಮ ಗುರಿ',
  'ಸೇವೆ ನಮ್ಮ ಧರ್ಮ',
  'ಸಮೃದ್ಧ ಭಾರತ ನಮ್ಮ ಕನಸು'
];
const TERMS = [
  'ಈ ಕಾರ್ಡ್ ಪಕ್ಷದ ಅಧಿಕೃತ ಸದಸ್ಯತ್ವದ ಆಧಾರ.',
  'ಈ ಕಾರ್ಡ್ ಅನ್ನು ಇತರರಿಗೆ ವರ್ಗಾಯಿಸುವುದು ಅಮಾನ್ಯ.',
  'ಹೆಚ್ಚಿನ ಮಾಹಿತಿಗಾಗಿ www.rjpindia.com ಗೆ ಭೇಟಿ ನೀಡಿ.'
];

function frontFields(member, joinDate) {
  return [
    { label: 'ಸದಸ್ಯ ಹೆಸರು', value: member.full_name, id: false },
    { label: 'ಸದಸ್ಯ ID', value: member.application_number, id: true },
    { label: 'ಜಿಲ್ಲೆ', value: member.district || '-', id: false },
    { label: 'ವಿಧಾನಸಭಾ ಕ್ಷೇತ್ರ', value: member.assembly || '-', id: false },
    { label: 'ಸದಸ್ಯತ್ವ ದಿನಾಂಕ', value: joinDate, id: false }
  ];
}

function measureFieldsHeight(doc, fields) {
  const valueOpts = { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: FRONT.valueSize, lineHeight: FRONT.valueLineH };
  return fields.reduce((sum, f) => {
    const valueH = wrappedHeight(doc, String(f.value), FRONT.fieldsW, valueOpts);
    return sum + FRONT.labelSize + FRONT.labelGap + valueH + FRONT.rowPad;
  }, 0);
}

function measureFrontHeight(doc, member) {
  const joinDate = (member.created_at || '').split(' ')[0];
  const fieldsH = measureFieldsHeight(doc, frontFields(member, joinDate));
  const bodyH = Math.max(FRONT.photoH, fieldsH);
  return FRONT.headerH + FRONT.badgeH + FRONT.bodyTop + bodyH + FRONT.sectionGap + FRONT.signRowH + FRONT.waveH + FRONT.footerH;
}

function measureBackHeight(doc) {
  const benefitOpts = { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: BACK.benefitSize, lineHeight: BACK.benefitLineH };
  const benefitsH = BENEFITS.reduce((sum, t, i) => sum + wrappedHeight(doc, t, BACK.benefitsW, benefitOpts) + (i < BENEFITS.length - 1 ? BACK.benefitGap : 0), 0);

  const qrKnOpts = { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: BACK.qrKnSize, lineHeight: BACK.qrKnLineH };
  const qrKnH = wrappedHeight(doc, 'ನಿಮ್ಮ ಸದಸ್ಯತ್ವವನ್ನು ಪರಿಶೀಲಿಸಲು QR ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', BACK.qrTextW, qrKnOpts);
  const qrTextH = qrKnH + 5 + BACK.qrEnSize;
  const qrRowH = Math.max(BACK.qrBox, qrTextH);

  const termOpts = { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: BACK.termSize, lineHeight: BACK.termLineH };
  const termsH = TERMS.reduce((sum, t, i) => sum + wrappedHeight(doc, t, BACK.termsW, termOpts) + (i < TERMS.length - 1 ? BACK.termGap : 0), 0);

  return BACK.headerH + BACK.sectionGap + benefitsH + BACK.sectionGap + qrRowH + BACK.sectionGap + termsH + BACK.sectionGap + BACK.footerH;
}

async function streamCardPdf(res, member, qrBuffer) {
  const measureDoc = new PDFDocument({ size: [W, 400], margin: 0 });
  measureDoc.registerFont('KN-Regular', KN_REGULAR);
  measureDoc.registerFont('KN-Bold', KN_BOLD);
  const H = Math.max(measureFrontHeight(measureDoc, member), measureBackHeight(measureDoc), 380) + 8;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="RJP-Membership-${member.application_number}.pdf"`);

  const doc = new PDFDocument({ size: [PAGE_W, H], margin: 0 });
  doc.registerFont('KN-Regular', KN_REGULAR);
  doc.registerFont('KN-Bold', KN_BOLD);
  doc.pipe(res);

  doc.rect(0, 0, PAGE_W, H).fill('#EDEFF3');

  doc.save();
  drawFront(doc, member, H);
  doc.restore();

  doc.save();
  doc.translate(W + GAP, 0);
  drawBack(doc, qrBuffer, H);
  doc.restore();

  doc.end();
}

function drawHeaderWave(doc, w, h) {
  const grad = doc.linearGradient(0, 0, w, h);
  grad.stop(0, '#FBDD86').stop(0.45, GOLD).stop(1, GREEN);
  doc.save();
  doc.moveTo(0, 0).lineTo(w, 0).lineTo(w, h * 0.72)
    .bezierCurveTo(w * 0.78, h * 0.94, w * 0.58, h * 0.66, w * 0.36, h * 0.79)
    .bezierCurveTo(w * 0.18, h * 0.9, w * 0.08, h * 0.96, 0, h * 0.82)
    .closePath().clip();
  doc.rect(0, 0, w, h).fill(grad);
  doc.restore();
}

function drawFront(doc, member, H) {
  doc.rect(0, 0, W, H).fill(WHITE);

  drawHeaderWave(doc, W, FRONT.headerH + 12);

  const logoCx = MARGIN + 30;
  const logoCy = 48;
  doc.circle(logoCx, logoCy, 30).fill(WHITE);
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  if (fs.existsSync(logoPath)) {
    try {
      doc.save();
      doc.circle(logoCx, logoCy, 27).clip();
      doc.image(logoPath, logoCx - 27, logoCy - 27, { width: 54, height: 54 });
      doc.restore();
    } catch (e) { /* ignore malformed image */ }
  }

  centeredMixedText(doc, 'RJP', W / 2, 20, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 28, color: BLUE });
  centeredMixedText(doc, 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ', W / 2, 52, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 12.5, color: BLUE });
  centeredMixedText(doc, 'RASHTRIYA JANAHITA PARTY', W / 2, 69, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica-Bold', fontSize: 6.5, color: GOLD_DEEP });
  centeredMixedText(doc, 'ಜನ ಮೊದಲು... ಅಧಿಕಾರ ನಂತರ', W / 2, 80, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 6.5, color: GREEN_DEEP });

  doc.roundedRect(W / 2 - 82, FRONT.headerH - FRONT.badgeH / 2, 164, FRONT.badgeH, FRONT.badgeH / 2)
    .fill(GREEN);
  centeredMixedText(doc, 'DIGITAL MEMBERSHIP CARD', W / 2, FRONT.headerH - 3, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 6.5, color: WHITE });

  const bodyY = FRONT.headerH + FRONT.badgeH / 2 + FRONT.bodyTop;
  const photoPath = member.photo_path ? path.join(PHOTO_DIR, member.photo_path) : null;
  if (photoPath && fs.existsSync(photoPath)) {
    try {
      doc.save();
      doc.roundedRect(MARGIN, bodyY, FRONT.photoW, FRONT.photoH, 6).clip();
      doc.image(photoPath, MARGIN, bodyY, { width: FRONT.photoW, height: FRONT.photoH });
      doc.restore();
    } catch (e) { /* ignore malformed image */ }
  } else {
    doc.roundedRect(MARGIN, bodyY, FRONT.photoW, FRONT.photoH, 6).fill('#eef0f5');
    doc.fillColor('#9aa3b5').font('Helvetica').fontSize(7).text('No Photo', MARGIN, bodyY + FRONT.photoH / 2 - 4, { width: FRONT.photoW, align: 'center' });
  }
  doc.roundedRect(MARGIN, bodyY, FRONT.photoW, FRONT.photoH, 6).lineWidth(1.5).stroke(GOLD);

  const joinDate = (member.created_at || '').split(' ')[0];
  const fields = frontFields(member, joinDate);
  const valueOpts = { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: FRONT.valueSize, lineHeight: FRONT.valueLineH };
  const fieldsH = measureFieldsHeight(doc, fields);
  const fieldsStartOffset = Math.max(0, (FRONT.photoH - fieldsH) / 2);
  let fy = bodyY + fieldsStartOffset;
  fields.forEach((f) => {
    mixedText(doc, f.label, FRONT.fieldsX, fy, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: FRONT.labelSize, color: MUTED });
    const valueY = fy + FRONT.labelSize + FRONT.labelGap;
    const valueH = drawWrapped(doc, String(f.value), FRONT.fieldsX, valueY, FRONT.fieldsW, { ...valueOpts, color: f.id ? GREEN : BLUE });
    fy += FRONT.labelSize + FRONT.labelGap + valueH + FRONT.rowPad;
  });

  const bodyBottom = Math.max(bodyY + FRONT.photoH, fy);
  const signY = bodyBottom + FRONT.sectionGap;

  const signaturePath = path.join(__dirname, '..', 'assets', 'images', 'card-signature.jpg');
  if (fs.existsSync(signaturePath)) {
    try { doc.image(signaturePath, MARGIN, signY, { width: 64, height: 22 }); } catch (e) { /* ignore malformed image */ }
  }
  doc.moveTo(MARGIN, signY + 28).lineTo(MARGIN + 64, signY + 28).strokeColor(LINE).lineWidth(0.75).stroke();
  doc.fillColor(MUTED).font('Helvetica').fontSize(6.5).text('Authorised Signatory', MARGIN, signY + 32, { width: 90 });

  doc.moveTo(MARGIN + 100, signY - 4).lineTo(MARGIN + 100, signY + 40).strokeColor(LINE).lineWidth(0.75).stroke();

  const verifySealPath = path.join(__dirname, '..', 'assets', 'images', 'card-verify-seal.jpg');
  const verifyCx = MARGIN + 124;
  doc.circle(verifyCx, signY + 15, 15).fill(GREEN);
  if (fs.existsSync(verifySealPath)) {
    try {
      doc.save();
      doc.circle(verifyCx, signY + 15, 15).clip();
      doc.image(verifySealPath, verifyCx - 15, signY, { width: 30, height: 30 });
      doc.restore();
    } catch (e) { drawCheckmark(doc, verifyCx, signY + 15, 15, WHITE); }
  } else {
    drawCheckmark(doc, verifyCx, signY + 15, 15, WHITE);
  }
  mixedText(doc, 'ಹೊಸ ಚಿಂತನೆ...', verifyCx + 22, signY + 2, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 7, color: GOLD_DEEP });
  mixedText(doc, 'ಹೊಸ ರಾಜಕೀಯ...', verifyCx + 22, signY + 13, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 7, color: GOLD_DEEP });
  mixedText(doc, 'ಹೊಸ ಭವಿಷ್ಯ...', verifyCx + 22, signY + 24, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 7, color: GOLD_DEEP });

  const waveY = H - FRONT.footerH - FRONT.waveH;
  doc.rect(0, waveY, W * 0.33, FRONT.waveH).fill(GOLD);
  doc.rect(W * 0.33, waveY, W * 0.67, FRONT.waveH).fill(GREEN);

  doc.rect(0, H - FRONT.footerH, W, FRONT.footerH).fill(GREEN);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(6.5).text('www.rjpindia.com', MARGIN, H - FRONT.footerH / 2 - 3);
  doc.fillColor(WHITE).font('Helvetica').fontSize(6.5).text('Reg. No. 56/283/2019-2020/PPS-1', 0, H - FRONT.footerH / 2 - 3, { width: W - MARGIN, align: 'right' });
}

function drawBack(doc, qrBuffer, H) {
  doc.rect(0, 0, W, H).fill(WHITE);

  const backHeaderGrad = doc.linearGradient(0, 0, 0, BACK.headerH);
  backHeaderGrad.stop(0, GREEN).stop(1, GREEN_DEEP);
  doc.rect(0, 0, W, BACK.headerH).fill(backHeaderGrad);
  doc.save();
  doc.rect(0, 0, W, BACK.headerH).clip();
  doc.circle(0, 0, 34).fillOpacity(0.08).fill(WHITE).fillOpacity(1);
  doc.restore();

  centeredMixedText(doc, 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP)', W / 2, 16, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 10.5, color: GOLD });
  centeredMixedText(doc, 'RASHTRIYA JANAHITA PARTY', W / 2, 32, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica-Bold', fontSize: 6.5, color: WHITE });
  centeredMixedText(doc, 'ಜನ ಮೊದಲು... ಅಧಿಕಾರ ನಂತರ', W / 2, 45, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 6.5, color: '#dff3e6' });

  const watermarkPath = path.join(__dirname, '..', 'assets', 'images', 'card-back-watermark.jpg');
  if (fs.existsSync(watermarkPath)) {
    try {
      doc.save();
      doc.rect(0, BACK.headerH, W, H - BACK.headerH - BACK.footerH).clip();
      doc.opacity(0.1);
      doc.image(watermarkPath, 0, BACK.headerH, { width: W });
      doc.opacity(1);
      doc.restore();
    } catch (e) { /* ignore malformed image */ }
  }

  let y = BACK.headerH + BACK.sectionGap;
  const benefitOpts = { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: BACK.benefitSize, lineHeight: BACK.benefitLineH };
  const benefitColors = [BLUE, GOLD_DEEP, BLUE, GOLD_DEEP, BLUE];
  BENEFITS.forEach((t, i) => {
    doc.circle(MARGIN + 8, y + 4, 8).fill(benefitColors[i % benefitColors.length]);
    drawCheckmark(doc, MARGIN + 8, y + 4, 6, WHITE);
    const h = drawWrapped(doc, t, BACK.benefitsTextX + 8, y, BACK.benefitsW - 8, { ...benefitOpts, color: '#1a1a1a' });
    y += Math.max(h, 16) + (i < BENEFITS.length - 1 ? BACK.benefitGap : 0);
  });
  y += BACK.sectionGap;

  doc.moveTo(MARGIN, y - BACK.sectionGap / 2).lineTo(W - MARGIN, y - BACK.sectionGap / 2).strokeColor(LINE).lineWidth(0.75).stroke();

  const qrKnOpts = { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: BACK.qrKnSize, lineHeight: BACK.qrKnLineH };
  const qrKnH = wrappedHeight(doc, 'ನಿಮ್ಮ ಸದಸ್ಯತ್ವವನ್ನು ಪರಿಶೀಲಿಸಲು QR ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', BACK.qrTextW, qrKnOpts);
  const qrTextH = qrKnH + 5 + BACK.qrEnSize;
  const qrRowH = Math.max(BACK.qrBox, qrTextH);

  doc.roundedRect(MARGIN, y, BACK.qrBox, BACK.qrBox, 8).fill(WHITE);
  doc.roundedRect(MARGIN, y, BACK.qrBox, BACK.qrBox, 8).lineWidth(1.5).stroke(GREEN);
  if (qrBuffer) {
    try { doc.image(qrBuffer, MARGIN + 4, y + 4, { width: BACK.qrBox - 8, height: BACK.qrBox - 8 }); } catch (e) { /* ignore */ }
  }
  const qrTextY = y + qrRowH / 2 - qrTextH / 2;
  drawWrapped(doc, 'ನಿಮ್ಮ ಸದಸ್ಯತ್ವವನ್ನು ಪರಿಶೀಲಿಸಲು QR ಕೋಡ್ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ', BACK.qrTextX, qrTextY, BACK.qrTextW, { ...qrKnOpts, color: '#1a1a1a' });
  mixedText(doc, 'Scan QR to Verify Your Membership', BACK.qrTextX, qrTextY + qrKnH + 5, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica-Bold', fontSize: BACK.qrEnSize, color: GREEN_DEEP });

  y += qrRowH + BACK.sectionGap;

  const termOpts = { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: BACK.termSize, lineHeight: BACK.termLineH };
  TERMS.forEach((t, i) => {
    doc.circle(MARGIN + 5, y + 3.5, 5).fill(GREEN);
    drawCheckmark(doc, MARGIN + 5, y + 3.5, 4, WHITE);
    const h = drawWrapped(doc, t, BACK.termsTextX + 5, y, BACK.termsW - 5, { ...termOpts, color: '#3a4152' });
    y += h + (i < TERMS.length - 1 ? BACK.termGap : 0);
  });

  doc.rect(0, H - BACK.footerH, W, BACK.footerH).fill(GREEN_DEEP);
  doc.fillColor('#dff3e6').font('Helvetica').fontSize(6).text('RJP HELPLINE', MARGIN, H - BACK.footerH + 7);
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(10).text('1800 123 2024', MARGIN, H - BACK.footerH + 16);
  doc.fillColor(WHITE).font('Helvetica').fontSize(7).text('info@rjpindia.com', 0, H - BACK.footerH / 2 - 3, { width: W - MARGIN, align: 'right' });
}

module.exports = { streamCardPdf };
