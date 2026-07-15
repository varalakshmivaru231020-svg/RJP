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

async function getSetting(key) {
  const row = await db.get('SELECT value FROM settings WHERE setting_key = ?', [key]);
  return row ? row.value : (SETTINGS_DEFAULTS[key] ?? '');
}

async function getAllSettings() {
  const out = { ...SETTINGS_DEFAULTS };
  const rows = await db.all('SELECT setting_key, value FROM settings');
  rows.forEach((r) => { out[r.setting_key] = r.value; });
  return out;
}

async function setSettings(obj) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(obj)) {
      await conn.query(
        'INSERT INTO settings (setting_key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [key, value]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { SETTINGS_DEFAULTS, getSetting, getAllSettings, setSettings };
