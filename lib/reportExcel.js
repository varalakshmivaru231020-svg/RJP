const fs = require('fs');
const ExcelJS = require('exceljs');

const NAVY = 'FF16234A';
const SAFFRON = 'FFF0A400';
const CREAM = 'FFFBF6EA';
const WHITE = 'FFFFFFFF';

function addLogo(workbook, sheet, logoPath) {
  if (!logoPath || !fs.existsSync(logoPath)) return false;
  try {
    const imageId = workbook.addImage({ filename: logoPath, extension: 'jpeg' });
    sheet.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 52, height: 52 } });
    return true;
  } catch (e) {
    return false;
  }
}

async function streamReportExcel(res, { title, rows, filters = [], logoPath }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RJP Admin Panel';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.replace(/[^A-Za-z0-9 ]/g, '').slice(0, 28) || 'Report', {
    views: [{ showGridLines: false }]
  });

  const hasDistrict = rows.length > 0 && rows[0].district !== undefined;
  const dataCols = hasDistrict
    ? [{ c: 3, key: 'label', header: 'Category' }, { c: 4, key: 'district', header: 'District' }, { c: 5, key: 'n', header: 'Members' }, { c: 6, key: 'pct', header: '% of Total' }]
    : [{ c: 3, key: 'label', header: 'Category' }, { c: 4, key: 'n', header: 'Members' }, { c: 5, key: 'pct', header: '% of Total' }];
  const lastCol = hasDistrict ? 'F' : 'E';

  sheet.columns = [
    { key: 'a', width: 8 }, { key: 'b', width: 26 },
    { key: 'label', width: 28 }, { key: 'district', width: hasDistrict ? 20 : 14 },
    { key: 'n', width: 14 }, { key: 'pct', width: 14 }
  ];

  const hasLogo = addLogo(workbook, sheet, logoPath);
  const total = rows.reduce((s, r) => s + r.n, 0);
  const textStartCol = hasLogo ? 'C' : 'A';

  sheet.mergeCells(`${textStartCol}1:${lastCol}1`);
  sheet.getCell(`${textStartCol}1`).value = 'Rashtriya Janahita Party';
  sheet.getCell(`${textStartCol}1`).font = { size: 15, bold: true, color: { argb: NAVY } };
  sheet.getRow(1).height = 22;

  sheet.mergeCells(`${textStartCol}2:${lastCol}2`);
  sheet.getCell(`${textStartCol}2`).value = `${title} Report — Total Members: ${total}`;
  sheet.getCell(`${textStartCol}2`).font = { size: 11, bold: true, color: { argb: 'FF1B7A3D' } };
  sheet.getRow(2).height = 18;

  sheet.mergeCells(`${textStartCol}3:${lastCol}3`);
  sheet.getCell(`${textStartCol}3`).value = `Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  sheet.getCell(`${textStartCol}3`).font = { size: 9, italic: true, color: { argb: 'FF5A6070' } };
  sheet.getRow(3).height = 15;

  let nextRow = 4;
  if (filters.length) {
    sheet.mergeCells(`A${nextRow}:${lastCol}${nextRow}`);
    sheet.getCell(`A${nextRow}`).value = `Applied Filters: ${filters.join('  |  ')}`;
    sheet.getCell(`A${nextRow}`).font = { size: 9, italic: true, color: { argb: 'FF5A6070' } };
    nextRow += 1;
  }
  nextRow += 1;

  const headerRow = sheet.getRow(nextRow);
  dataCols.forEach(({ c, header }) => {
    const cell = headerRow.getCell(c);
    cell.value = header;
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle', horizontal: c === 3 ? 'left' : 'center' };
  });
  headerRow.height = 20;
  nextRow += 1;

  rows.forEach((r, i) => {
    const pct = total ? `${((r.n / total) * 100).toFixed(1)}%` : '0%';
    const row = sheet.getRow(nextRow);
    dataCols.forEach(({ c, key }) => {
      row.getCell(c).value = key === 'pct' ? pct : r[key];
      row.getCell(c).alignment = { horizontal: c === 3 ? 'left' : 'center' };
    });
    if (i % 2 === 0) {
      dataCols.forEach(({ c }) => { row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }; });
    }
    nextRow += 1;
  });

  const totalRow = sheet.getRow(nextRow);
  const membersCol = hasDistrict ? 5 : 4;
  const pctCol = hasDistrict ? 6 : 5;
  totalRow.getCell(3).value = 'Total';
  totalRow.getCell(membersCol).value = total;
  totalRow.getCell(pctCol).value = '100%';
  dataCols.forEach(({ c }) => {
    const cell = totalRow.getCell(c);
    cell.font = { bold: true, color: { argb: NAVY } };
    cell.border = { top: { style: 'thin', color: { argb: SAFFRON } } };
    cell.alignment = { horizontal: c === 3 ? 'left' : 'center' };
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="RJP-Report-${title.replace(/\s+/g, '-')}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

async function streamMembersExcel(res, members, logoPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RJP Admin Panel';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Members', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });

  const columns = [
    { key: 'application_number', width: 18 }, { key: 'full_name', width: 24 }, { key: 'mobile', width: 14 },
    { key: 'gender', width: 10 }, { key: 'district', width: 18 }, { key: 'assembly', width: 20 },
    { key: 'occupation', width: 18 }, { key: 'religion', width: 14 }, { key: 'status', width: 16 }, { key: 'created_at', width: 20 }
  ];
  sheet.columns = columns;

  const hasLogo = addLogo(workbook, sheet, logoPath);
  const textStartCol = hasLogo ? 'C' : 'A';
  sheet.mergeCells(`${textStartCol}1:F1`);
  sheet.getCell(`${textStartCol}1`).value = 'Rashtriya Janahita Party';
  sheet.getCell(`${textStartCol}1`).font = { size: 15, bold: true, color: { argb: NAVY } };
  sheet.mergeCells(`${textStartCol}2:F2`);
  sheet.getCell(`${textStartCol}2`).value = `All Members Export — Total: ${members.length}`;
  sheet.getCell(`${textStartCol}2`).font = { size: 11, bold: true, color: { argb: 'FF1B7A3D' } };
  sheet.mergeCells(`${textStartCol}3:F3`);
  sheet.getCell(`${textStartCol}3`).value = `Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  sheet.getCell(`${textStartCol}3`).font = { size: 9, italic: true, color: { argb: 'FF5A6070' } };
  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 15;

  const headerLabels = ['Membership ID', 'Full Name', 'Mobile', 'Gender', 'District', 'Assembly', 'Occupation', 'Religion', 'Status', 'Registered On'];
  const headerRow = sheet.getRow(4);
  headerLabels.forEach((label, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  });
  headerRow.height = 20;

  members.forEach((m, i) => {
    const row = sheet.addRow(m);
    if (i % 2 === 0) row.eachCell((cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREAM } }; });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="RJP-Members-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { streamReportExcel, streamMembersExcel };
