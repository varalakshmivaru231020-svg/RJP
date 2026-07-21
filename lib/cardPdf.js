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

const W = 340;
const MARGIN = 20;
const GAP = 24;
const PAGE_W = W * 2 + GAP;
const CARD_RADIUS = 14;

const KN_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKannada-Regular.ttf');
const KN_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansKannada-Bold.ttf');

// Same artwork the on-screen card (views/member-card.ejs) uses, so the PDF matches it exactly.
const HEADER_BANNER = path.join(__dirname, '..', 'assets', 'images', 'card-header-banner.png');
const HEADER_BANNER_DIM = { w: 752, h: 376 };
const BACK_GRAPHIC = path.join(__dirname, '..', 'assets', 'images', 'card-back-graphic.png');
const BACK_GRAPHIC_DIM = { w: 360, h: 645 };

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

function centeredWrapped(doc, text, centerX, y, maxWidth, opts) {
  const { kannadaFont, latinFont, fontSize, color, lineHeight } = opts;
  const lines = wrapWords(doc, text, maxWidth, opts);
  doc.font(latinFont).fontSize(fontSize);
  const spaceWidth = doc.widthOfString(' ');
  doc.fillColor(color);
  lines.forEach((line, li) => {
    const lineWidth = line.reduce((s, t) => s + t.w, 0) + spaceWidth * Math.max(0, line.length - 1);
    let cx = centerX - lineWidth / 2;
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

// Emulates CSS `object-fit:cover` — scales an image up to fill (x,y,w,h) and
// clips the overflow, so raster art crops the same way it does on screen.
function drawCoverImage(doc, imgPath, x, y, w, h, imgW, imgH, opts) {
  if (!fs.existsSync(imgPath)) return;
  const alignX = (opts && opts.alignX) || 'center';
  const alignY = (opts && opts.alignY) || 'center';
  const scale = Math.max(w / imgW, h / imgH);
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const dx = x - (drawW - w) * (alignX === 'left' ? 0 : alignX === 'right' ? 1 : 0.5);
  const dy = y - (drawH - h) * (alignY === 'top' ? 0 : alignY === 'bottom' ? 1 : 0.5);
  try {
    doc.save();
    doc.rect(x, y, w, h).clip();
    doc.image(imgPath, dx, dy, { width: drawW, height: drawH });
    doc.restore();
  } catch (e) { /* ignore malformed image */ }
}

// Draws one of the small line-icons below (viewBox 24x24, matching the SVGs
// used on the on-screen card) at (x,y) scaled to `size`.
function drawIcon(doc, drawFn, x, y, size, color) {
  doc.save();
  doc.translate(x, y).scale(size / 24);
  drawFn(doc, color);
  doc.restore();
}

function iconGlobe(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineCap('round').lineJoin('round');
  doc.circle(12, 12, 10).stroke();
  doc.moveTo(2, 12).lineTo(22, 12).stroke();
  doc.path('M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z').stroke();
}

function iconFacebook(doc, color) {
  doc.fillColor(color);
  doc.path('M22 12a10 10 0 1 0-11.5 9.9v-7H8v-2.9h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.3c-1.2 0-1.6.8-1.6 1.6v1.9H16l-.4 2.9h-2.1v7A10 10 0 0 0 22 12z').fill();
}

function iconX(doc, color) {
  doc.fillColor(color);
  doc.path('M18.9 2H22l-7.6 8.7L23 22h-6.7l-5.2-6.8L5 22H2l8.1-9.3L1.6 2h6.9l4.7 6.2L18.9 2z').fill();
}

function iconInstagram(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineJoin('round');
  doc.roundedRect(2, 2, 20, 20, 5).stroke();
  doc.circle(12, 12, 4.5).stroke();
  doc.circle(17.3, 6.7, 1.1).fill(color);
}

function iconYoutube(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineJoin('round');
  doc.roundedRect(2, 5, 20, 14, 4).stroke();
  doc.polygon([10, 9], [16, 12], [10, 15]).fill(color);
}

function iconPeople(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineCap('round').lineJoin('round');
  doc.path('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2').stroke();
  doc.circle(9, 7, 4).stroke();
  doc.path('M23 21v-2a4 4 0 0 0-3-3.87').stroke();
  doc.path('M16 3.13a4 4 0 0 1 0 7.75').stroke();
}

function iconShield(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineCap('round').lineJoin('round');
  doc.path('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z').stroke();
}

function iconScale(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineCap('round').lineJoin('round');
  doc.moveTo(12, 3).lineTo(12, 21).stroke();
  doc.moveTo(5, 7).lineTo(19, 7).stroke();
  doc.path('M5 7l-3 6a3 3 0 0 0 6 0z').stroke();
  doc.path('M19 7l-3 6a3 3 0 0 0 6 0z').stroke();
  doc.moveTo(8, 21).lineTo(16, 21).stroke();
}

function iconHeart(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineCap('round').lineJoin('round');
  doc.path('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z').stroke();
}

function iconTarget(doc, color) {
  doc.lineWidth(2).strokeColor(color).lineCap('round').lineJoin('round');
  doc.moveTo(23, 6).lineTo(13.5, 15.5).lineTo(8.5, 10.5).lineTo(1, 18).stroke();
  doc.moveTo(17, 6).lineTo(23, 6).lineTo(23, 12).stroke();
}

function drawSocialRow(doc, icons, x, centerY, opts) {
  const { chip, iconSize, gap, color, chipOpacity } = opts;
  let cx = x;
  icons.forEach((fn) => {
    if (chipOpacity) {
      doc.fillOpacity(chipOpacity).circle(cx + chip / 2, centerY, chip / 2).fill(WHITE).fillOpacity(1);
    }
    drawIcon(doc, fn, cx + (chip - iconSize) / 2, centerY - iconSize / 2, iconSize, color);
    cx += chip + gap;
  });
}

const SOCIAL_ICONS = [iconFacebook, iconX, iconInstagram, iconYoutube];

// ---- Layout constants (premium gold/green party-seal style, matches the on-screen card) ----
const FRONT = {
  headerH: 128, badgeGap: 8, badgeH: 20, bodyGap: 12,
  photoW: 78, photoH: 96, fieldsGap: 14,
  labelSize: 6.5, valueSize: 9.5, valueLineH: 11.5, labelGap: 3, rowPad: 8,
  sectionGap: 14,
  signCapW: 78, signImgSize: 62, capSize: 6.5, capLineH: 8, capGap: 4,
  verifyLineH: 11, signColGap: 14,
  waveH: 5, footerH: 26
};
FRONT.fieldsX = MARGIN + FRONT.photoW + FRONT.fieldsGap;
FRONT.fieldsW = W - MARGIN - FRONT.fieldsX;
FRONT.signDividerX = MARGIN + FRONT.signCapW + FRONT.signColGap;
FRONT.verifyX = FRONT.signDividerX + FRONT.signColGap;
FRONT.verifyW = W - MARGIN - FRONT.verifyX;

const BACK = {
  headerH: 64, sectionGap: 14,
  graphicWRatio: 0.42,
  benefitIcon: 16, benefitGlyph: 9, benefitSize: 7.5, benefitLineH: 10, benefitGap: 8,
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

const SIGN_CAPTION = 'AUTHORISED DIGITAL VERIFICATION';
const VERIFY_LINES = ['ಹೊಸ ಚಿಂತನೆ...', 'ಹೊಸ ರಾಜಕೀಯ...', 'ಹೊಸ ಭವಿಷ್ಯ...'];

const BENEFITS = [
  'ಜನರೊಂದಿಗೆ... ಜನರಿಗಾಗಿ... ಜನಹಿತಕ್ಕಾಗಿ',
  'ಪಾರದರ್ಶಕತೆ ನಮ್ಮ ಬದ್ಧತೆ',
  'ನ್ಯಾಯ, ಸಮಾನತೆ, ಅಭಿವೃದ್ಧಿ ನಮ್ಮ ಗುರಿ',
  'ಸೇವೆ ನಮ್ಮ ಧರ್ಮ',
  'ಸಮೃದ್ಧ ಭಾರತ ನಮ್ಮ ಕನಸು'
];
const BENEFIT_ICONS = [iconPeople, iconShield, iconScale, iconHeart, iconTarget];
const TERMS = [
  'ಈ ಕಾರ್ಡ್ ನಮ್ಮ ಪಕ್ಷದ ಅಧಿಕೃತ ಸದಸ್ಯತ್ವದ ಆಧಾರವಾಗಿದೆ.',
  'ಈ ಕಾರ್ಡ್ ಅನ್ನು ಇತರರಿಗೆ ವರ್ಗಾಯಿಸುವುದು ಅಮಾನ್ಯ.',
  'ನಮ್ಮ ಪಕ್ಷದ ಎಲ್ಲಾ ಕಾರ್ಯಕ್ರಮಗಳಲ್ಲಿ ಮತ್ತು ಸೇವೆಗಳಲ್ಲಿ ಬಳಸಬಹುದು. www.rjpindia.com ಗೆ ಭೇಟಿ ನೀಡಿ.'
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

function computeSignRowHeight(doc) {
  const capOpts = { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: FRONT.capSize, lineHeight: FRONT.capLineH };
  const capH = wrappedHeight(doc, SIGN_CAPTION, FRONT.signCapW, capOpts);
  const leftColH = FRONT.signImgSize + FRONT.capGap + 2 + capH;
  const verifyH = VERIFY_LINES.length * FRONT.verifyLineH;
  return Math.max(leftColH, verifyH);
}

function measureFrontHeight(doc, member) {
  const joinDate = (member.created_at || '').split(' ')[0];
  const fieldsH = measureFieldsHeight(doc, frontFields(member, joinDate));
  const bodyH = Math.max(FRONT.photoH, fieldsH);
  const signRowH = computeSignRowHeight(doc);
  return FRONT.headerH + FRONT.badgeGap + FRONT.badgeH + FRONT.bodyGap + bodyH + FRONT.sectionGap + signRowH + FRONT.waveH + FRONT.footerH;
}

function measureBackHeight(doc) {
  const benefitOpts = { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: BACK.benefitSize, lineHeight: BACK.benefitLineH };
  const benefitsH = BENEFITS.reduce((sum, t, i) => sum + Math.max(wrappedHeight(doc, t, BACK.benefitsW, benefitOpts), BACK.benefitIcon) + (i < BENEFITS.length - 1 ? BACK.benefitGap : 0), 0);

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

function drawFront(doc, member, H) {
  doc.roundedRect(3, 8, W, H, CARD_RADIUS).fillOpacity(0.16).fill('#0B1432').fillOpacity(1);

  doc.save();
  doc.roundedRect(0, 0, W, H, CARD_RADIUS).clip();
  doc.rect(0, 0, W, H).fill(WHITE);

  drawCoverImage(doc, HEADER_BANNER, 0, 0, W, FRONT.headerH, HEADER_BANNER_DIM.w, HEADER_BANNER_DIM.h);

  const badgeY = FRONT.headerH + FRONT.badgeGap;
  doc.roundedRect(MARGIN, badgeY, W - 2 * MARGIN, FRONT.badgeH, 6).fill(GREEN);
  centeredMixedText(doc, 'DIGITAL MEMBERSHIP CARD', W / 2, badgeY + FRONT.badgeH / 2 - 3.5, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 7.5, color: WHITE });

  const bodyY = badgeY + FRONT.badgeH + FRONT.bodyGap;
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
  const signRowH = computeSignRowHeight(doc);

  const imgX = MARGIN + (FRONT.signCapW - FRONT.signImgSize) / 2;
  const sealCx = imgX + FRONT.signImgSize / 2;
  const sealCy = signY + FRONT.signImgSize / 2;
  const sealR = FRONT.signImgSize / 2;
  doc.save();
  doc.dash(1.6, { space: 2.2 }).lineWidth(1.25).strokeColor(GREEN);
  doc.circle(sealCx, sealCy, sealR - 1.5).stroke();
  doc.undash();
  doc.restore();
  doc.circle(sealCx, sealCy, sealR * 0.42).fill(GREEN);
  drawCheckmark(doc, sealCx, sealCy, sealR * 0.5, WHITE);

  const capTopY = signY + FRONT.signImgSize + 2;
  doc.moveTo(MARGIN, capTopY).lineTo(MARGIN + FRONT.signCapW, capTopY).strokeColor(LINE).lineWidth(0.75).stroke();
  centeredWrapped(doc, SIGN_CAPTION, MARGIN + FRONT.signCapW / 2, capTopY + FRONT.capGap, FRONT.signCapW, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: FRONT.capSize, lineHeight: FRONT.capLineH, color: BLUE });

  doc.moveTo(FRONT.signDividerX, signY).lineTo(FRONT.signDividerX, signY + signRowH).strokeColor(LINE).lineWidth(0.75).stroke();

  const verifyBlockH = VERIFY_LINES.length * FRONT.verifyLineH;
  let vy = signY + (signRowH - verifyBlockH) / 2;
  VERIFY_LINES.forEach((line) => {
    mixedText(doc, line, FRONT.verifyX, vy, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 7, color: GOLD_DEEP });
    vy += FRONT.verifyLineH;
  });

  const waveY = H - FRONT.footerH - FRONT.waveH;
  doc.rect(0, waveY, W * 0.33, FRONT.waveH).fill(GOLD);
  doc.rect(W * 0.33, waveY, W * 0.67, FRONT.waveH).fill(GREEN);

  const footY = H - FRONT.footerH;
  const footMidY = footY + FRONT.footerH / 2;
  doc.rect(0, footY, W, FRONT.footerH).fill(GREEN);
  drawIcon(doc, iconGlobe, MARGIN, footMidY - 6, 12, WHITE);
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(6.5).text('www.rjpindia.com', MARGIN + 16, footMidY - 3);

  const chip = 16, iconSize = 9, gap = 6;
  const socialX = W - MARGIN - (chip * SOCIAL_ICONS.length + gap * (SOCIAL_ICONS.length - 1));
  drawSocialRow(doc, SOCIAL_ICONS, socialX, footMidY, { chip, iconSize, gap, color: WHITE, chipOpacity: 0.18 });

  doc.restore();
  doc.roundedRect(0, 0, W, H, CARD_RADIUS).lineWidth(1).strokeColor('#D7DBE3').stroke();
}

function drawHeaderWave(doc, w, h) {
  const grad = doc.linearGradient(0, 0, 0, h);
  grad.stop(0, GREEN).stop(1, GREEN_DEEP);
  doc.rect(0, 0, w, h).fill(grad);
}

function drawBack(doc, qrBuffer, H) {
  doc.roundedRect(3, 8, W, H, CARD_RADIUS).fillOpacity(0.16).fill('#0B1432').fillOpacity(1);

  doc.save();
  doc.roundedRect(0, 0, W, H, CARD_RADIUS).clip();
  doc.rect(0, 0, W, H).fill(WHITE);

  drawHeaderWave(doc, W, BACK.headerH);
  doc.save();
  doc.rect(0, 0, W, BACK.headerH).clip();
  doc.circle(0, 0, 34).fillOpacity(0.08).fill(WHITE).fillOpacity(1);
  doc.restore();

  centeredMixedText(doc, 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP)', W / 2, 16, { kannadaFont: 'KN-Bold', latinFont: 'Helvetica-Bold', fontSize: 10.5, color: GOLD });
  centeredMixedText(doc, 'RASHTRIYA JANAHITA PARTY', W / 2, 32, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica-Bold', fontSize: 6.5, color: WHITE });
  centeredMixedText(doc, 'ಜನ ಮೊದಲು... ಅಧಿಕಾರ ನಂತರ', W / 2, 45, { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: 6.5, color: '#dff3e6' });

  const gW = W * BACK.graphicWRatio;
  const gX = W - gW;
  const gY = BACK.headerH;
  const gH = H - BACK.footerH - BACK.headerH;
  if (fs.existsSync(BACK_GRAPHIC)) {
    drawCoverImage(doc, BACK_GRAPHIC, gX, gY, gW, gH, BACK_GRAPHIC_DIM.w, BACK_GRAPHIC_DIM.h, { alignY: 'top' });
    try {
      const fade = doc.linearGradient(gX, gY, gX + gW, gY);
      fade.stop(0, WHITE, 1).stop(0.32, WHITE, 0).stop(1, WHITE, 0);
      doc.rect(gX, gY, gW, gH).fill(fade);
    } catch (e) { /* ignore gradient failure */ }
  }

  let y = BACK.headerH + BACK.sectionGap;
  const benefitOpts = { kannadaFont: 'KN-Regular', latinFont: 'Helvetica', fontSize: BACK.benefitSize, lineHeight: BACK.benefitLineH };
  const benefitColors = [BLUE, GOLD_DEEP, BLUE, GOLD_DEEP, BLUE];
  BENEFITS.forEach((t, i) => {
    const cy = y + BACK.benefitIcon / 2;
    doc.circle(MARGIN + BACK.benefitIcon / 2, cy, BACK.benefitIcon / 2).fill(benefitColors[i % benefitColors.length]);
    drawIcon(doc, BENEFIT_ICONS[i], MARGIN + (BACK.benefitIcon - BACK.benefitGlyph) / 2, cy - BACK.benefitGlyph / 2, BACK.benefitGlyph, WHITE);
    const h = drawWrapped(doc, t, BACK.benefitsTextX + 8, y + (BACK.benefitIcon - BACK.benefitLineH) / 2, BACK.benefitsW - 8, { ...benefitOpts, color: '#1a1a1a' });
    y += Math.max(h, BACK.benefitIcon) + (i < BENEFITS.length - 1 ? BACK.benefitGap : 0);
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
  doc.fillColor(GOLD).font('Helvetica-Bold').fontSize(10).text('9632527961', MARGIN, H - BACK.footerH + 16);

  const footMidY = H - BACK.footerH / 2;
  const emailText = 'rjpkarnataka@gmail.com';
  doc.font('Helvetica').fontSize(7);
  const emailW = doc.widthOfString(emailText);
  const chip = 14, iconSize = 7, sgap = 5;
  const socialW = chip * SOCIAL_ICONS.length + sgap * (SOCIAL_ICONS.length - 1);
  const rightGroupW = emailW + 10 + socialW;
  const emailX = W - MARGIN - rightGroupW;
  doc.fillColor(WHITE).text(emailText, emailX, footMidY - 3);
  drawSocialRow(doc, SOCIAL_ICONS, emailX + emailW + 10, footMidY, { chip, iconSize, gap: sgap, color: WHITE, chipOpacity: 0.18 });

  doc.restore();
  doc.roundedRect(0, 0, W, H, CARD_RADIUS).lineWidth(1).strokeColor('#D7DBE3').stroke();
}

module.exports = { streamCardPdf };
