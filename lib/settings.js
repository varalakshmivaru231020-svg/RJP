const db = require('../db');

const SETTINGS_DEFAULTS = {
  membership_prefix: 'RJP',
  primary_color: '#F0A400',
  qr_color: '#16234A',
  email_from: 'noreply@rjpindia.com',
  email_smtp_host: '',
  email_smtp_user: '',
  email_smtp_pass: '',
  sms_api_key: '',
  sms_sender_id: '',
  whatsapp_api_token: '',
  whatsapp_api_number: ''
};

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : (SETTINGS_DEFAULTS[key] ?? '');
}

function getAllSettings() {
  const out = { ...SETTINGS_DEFAULTS };
  db.prepare('SELECT key, value FROM settings').all().forEach((r) => { out[r.key] = r.value; });
  return out;
}

function setSettings(obj) {
  const stmt = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const tx = db.transaction((entries) => entries.forEach(([k, v]) => stmt.run(k, v)));
  tx(Object.entries(obj));
}

module.exports = { SETTINGS_DEFAULTS, getSetting, getAllSettings, setSettings };
