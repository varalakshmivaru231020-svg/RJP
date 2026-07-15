const fs = require('fs');
const PDFDocument = require('pdfkit');

const COLORS = ['#1E3A8A', '#16A34A', '#F59E0B', '#0EA5E9', '#DC2626', '#0F172A', '#7C3AED', '#EA580C', '#0D9488', '#64748B'];

function drawBarH(doc, x, y, width, rows) {
  const maxN = Math.max(...rows.map((r) => r.n), 1);
  const barHeight = 14;
  const gap = 10;
  rows.forEach((r, i) => {
    const by = y + i * (barHeight + gap);
    const barW = Math.max(2, (r.n / maxN) * (width - 140));
    doc.fontSize(8).fillColor('#1F2937').text(String(r.label).slice(0, 22), x, by + 2, { width: 118 });
    doc.rect(x + 122, by, barW, barHeight).fill(COLORS[i % COLORS.length]);
    doc.fontSize(8).fillColor('#1F2937').text(String(r.n), x + 122 + barW + 6, by + 2);
  });
  return y + rows.length * (barHeight + gap);
}

function drawBarV(doc, x, y, width, height, rows) {
  const maxN = Math.max(...rows.map((r) => r.n), 1);
  const gap = 14;
  const barW = Math.min(46, (width - gap * (rows.length + 1)) / rows.length);
  rows.forEach((r, i) => {
    const bx = x + gap + i * (barW + gap);
    const barH = Math.max(2, (r.n / maxN) * height);
    const by = y + height - barH;
    doc.rect(bx, by, barW, barH).fill(COLORS[i % COLORS.length]);
    doc.fontSize(7.5).fillColor('#1F2937').text(String(r.n), bx, by - 11, { width: barW, align: 'center' });
    doc.fontSize(7).fillColor('#64748B').text(String(r.label).slice(0, 10), bx, y + height + 4, { width: barW, align: 'center' });
  });
  return y + height + 20;
}

function drawPie(doc, cx, cy, radius, rows) {
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  let startAngle = -Math.PI / 2;
  rows.forEach((r, i) => {
    const sliceAngle = (r.n / total) * Math.PI * 2;
    const endAngle = startAngle + sliceAngle;
    const steps = Math.max(2, Math.ceil((sliceAngle / (Math.PI * 2)) * 80));
    const points = [[cx, cy]];
    for (let s = 0; s <= steps; s++) {
      const a = startAngle + (sliceAngle * s) / steps;
      points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
    doc.polygon(...points).fill(COLORS[i % COLORS.length]);
    startAngle = endAngle;
  });

  const legendX = cx + radius + 30;
  let legendY = cy - radius;
  rows.forEach((r, i) => {
    const pct = total ? ((r.n / total) * 100).toFixed(1) : '0.0';
    doc.rect(legendX, legendY, 9, 9).fill(COLORS[i % COLORS.length]);
    doc.fontSize(8).fillColor('#1F2937').text(`${r.label} — ${r.n} (${pct}%)`, legendX + 14, legendY - 1, { width: 180 });
    legendY += 16;
  });
}

function streamReportPdf(res, opts) {
  const { title, chartType = 'bar-h', rows, filters = [], logoPath } = opts;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="RJP-Report-${title.replace(/\s+/g, '-')}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(res);

  if (logoPath && fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 50, 40, { width: 40, height: 40 }); } catch (e) { /* ignore */ }
  }
  doc.fontSize(17).fillColor('#0F172A').font('Helvetica-Bold').text('Rashtriya Janahita Party', 100, 44);
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#1E3A8A').text(`${title} Report`, 100, 64);
  doc.fontSize(8).font('Helvetica').fillColor('#64748B').text(`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`, 100, 78);

  doc.moveTo(50, 96).lineTo(545, 96).strokeColor('#E5E7EB').stroke();

  let y = 108;
  if (filters.length) {
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1F2937').text('Applied Filters: ', 50, y, { continued: true });
    doc.font('Helvetica').fillColor('#64748B').text(filters.join('   |   '));
    y = doc.y + 8;
  }

  const total = rows.reduce((s, r) => s + r.n, 0);
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1F2937').text(`Total Members: ${total}`, 50, y);
  y += 20;

  if (!rows.length) {
    doc.fontSize(10).fillColor('#64748B').text('No data available for this report.', 50, y);
  } else {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F172A').text('Distribution', 50, y);
    y += 18;

    if (chartType === 'bar-h') {
      y = drawBarH(doc, 50, y, 495, rows.slice(0, 12)) + 14;
    } else if (chartType === 'bar-v') {
      y = drawBarV(doc, 50, y, 495, 140, rows) + 10;
    } else {
      drawPie(doc, 130, y + 80, 70, rows.slice(0, 8));
      y += 190;
    }

    if (y > 680) { doc.addPage(); y = 50; }

    doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
    y += 12;

    const hasDistrict = rows.length > 0 && rows[0].district !== undefined;
    const cols = hasDistrict
      ? { label: 50, district: 270, members: 400, pct: 470 }
      : { label: 50, district: null, members: 350, pct: 450 };

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#1F2937');
    doc.text('Category', cols.label, y);
    if (hasDistrict) doc.text('District', cols.district, y);
    doc.text('Members', cols.members, y);
    doc.text('% of Total', cols.pct, y);
    y += 14;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#0F172A').stroke();
    y += 8;

    doc.font('Helvetica').fontSize(9.5);
    rows.forEach((r) => {
      if (y > 770) { doc.addPage(); y = 50; }
      const pct = total ? `${((r.n / total) * 100).toFixed(1)}%` : '0%';
      doc.fillColor('#1F2937').text(String(r.label), cols.label, y, { width: hasDistrict ? 210 : 280 });
      if (hasDistrict) doc.text(String(r.district), cols.district, y, { width: 120 });
      doc.text(String(r.n), cols.members, y);
      doc.text(pct, cols.pct, y);
      y += 18;
    });

    y += 4;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#F59E0B').stroke();
    y += 8;
    doc.font('Helvetica-Bold').fillColor('#0F172A').text('Total', cols.label, y);
    doc.text(String(total), cols.members, y);
    doc.text('100%', cols.pct, y);
  }

  doc.end();
}

module.exports = { streamReportPdf };
