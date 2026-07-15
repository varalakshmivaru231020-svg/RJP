const QRCode = require('qrcode');
const { getSetting } = require('./settings');

function verifyUrl(req, applicationNumber) {
  return `${req.protocol}://${req.get('host')}/verify/${encodeURIComponent(applicationNumber)}`;
}

async function cardQrDataUrl(req, applicationNumber) {
  const dark = getSetting('qr_color') || '#16234A';
  return QRCode.toDataURL(verifyUrl(req, applicationNumber), { margin: 1, width: 200, color: { dark, light: '#FFFFFF' } });
}

async function cardQrBuffer(req, applicationNumber) {
  const dark = getSetting('qr_color') || '#16234A';
  return QRCode.toBuffer(verifyUrl(req, applicationNumber), { margin: 1, width: 200, color: { dark, light: '#FFFFFF' } });
}

module.exports = { cardQrDataUrl, cardQrBuffer };
