const { getSetting } = require('./settings');

function nextApplicationNumber(db) {
  const prefix = getSetting('membership_prefix') || 'RJP';
  const year = new Date().getFullYear();
  const row = db.prepare('SELECT COUNT(*) AS n FROM members WHERE application_number LIKE ?').get(`${prefix}${year}%`);
  const seq = String(row.n + 1).padStart(5, '0');
  return `${prefix}${year}${seq}`;
}

module.exports = { nextApplicationNumber };
