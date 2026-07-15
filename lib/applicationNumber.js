const { getSetting } = require('./settings');

async function nextApplicationNumber(db) {
  const prefix = (await getSetting('membership_prefix')) || 'RJP';
  const year = new Date().getFullYear();
  const row = await db.get('SELECT COUNT(*) AS n FROM members WHERE application_number LIKE ?', [`${prefix}${year}%`]);
  const seq = String(row.n + 1).padStart(5, '0');
  return `${prefix}${year}${seq}`;
}

module.exports = { nextApplicationNumber };
