const db = require('../db');

const CMS_DEFAULTS = {
  banner: {
    heading: 'ಅಧಿಕಾರಕ್ಕಾಗಿ ಅಲ್ಲ... ಜನಹಿತಕ್ಕಾಗಿ ಒಂದು ಹೊಸ ರಾಜಕೀಯ ಪಯಣ',
    lede: 'ಸ್ವಾತಂತ್ರ್ಯ ಬಂದು ಎಂಟು ದಶಕಗಳಾದರೂ, ಒಬ್ಬ ಸಾಮಾನ್ಯ ರೈತ, ಒಬ್ಬ ನಿರುದ್ಯೋಗಿ ಯುವಕ, ಒಬ್ಬ ಮಧ್ಯಮ ವರ್ಗದ ತಂದೆ ಇನ್ನೂ ತನ್ನ ಕನಸುಗಳಿಗಾಗಿ ಕಾಯುತ್ತಿದ್ದಾನೆ. ಇದಕ್ಕೆ ಬೇಕಿರುವುದು ಹಳೆಯ ಪರಿಹಾರವಲ್ಲ, ಹೊಸ ಚಿಂತನೆ — ಅದೇ ಕಾರಣಕ್ಕೆ ಹುಟ್ಟಿದ್ದು ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP).',
    slides: [
      '/images/flag.jpg | RJP ಧ್ವಜ ಹಾರಾಡುತ್ತಿದೆ',
      '/images/agenda-poster.jpg | RJP ಅಭಿಯಾನ ಜಮಾಯೆತ್ತು ವಿಧಾನಸೌಧದ ಮುಂದೆ',
      '/images/gallery-5.jpg | RJP ಬೆಂಬಲಿಗರ ಜಮಾಯೆತ್ತು'
    ]
  },
  about: {
    eyebrow: 'RJP ಹುಟ್ಟಿದ ಉದ್ದೇಶ',
    heading: 'ರಾಜಕೀಯ ಎಂದರೆ ಅಧಿಕಾರವಲ್ಲ — ಅದು ಸೇವೆ',
    body: [
      'ಭ್ರಷ್ಟಾಚಾರ, ಆಡಳಿತದ ವಿಳಂಬ, ಜನ ಮತ್ತು ಸರ್ಕಾರದ ನಡುವಿನ ಅಂತರ — ಇವು ಇಂದಿಗೂ ಜನಸಾಮಾನ್ಯರ ದೈನಂದಿನ ಸವಾಲುಗಳಾಗಿವೆ. ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP) ಜನಸಾಮಾನ್ಯರ ಧ್ವನಿಯಾಗಿ, ಪಾರದರ್ಶಕ ಮತ್ತು ಹೊಣೆಗಾರಿಕೆಯುತ ಆಡಳಿತದ ಗುರಿಯೊಂದಿಗೆ ಸ್ಥಾಪನೆಗೊಂಡ ಪಕ್ಷ.',
      'ವ್ಯಕ್ತಿಪೂಜೆಗಿಂತ ತತ್ವ, ಅಧಿಕಾರಕ್ಕಿಂತ ಸೇವೆ ಎಂಬ ನಂಬಿಕೆಯೊಂದಿಗೆ ನಾವು ಕಾರ್ಯ ನಿರ್ವಹಿಸುತ್ತೇವೆ.'
    ],
    pillars: [
      'ರೈತನ ಬದುಕಿಗೆ ಭದ್ರತೆ',
      'ಯುವಕರ ಕನಸಿಗೆ ಅವಕಾಶ',
      'ಮಹಿಳೆಯರಿಗೆ ಗೌರವ ಮತ್ತು ಸುರಕ್ಷತೆ',
      'ಸಾಮಾನ್ಯ ನಾಗರಿಕನಿಗೆ ನ್ಯಾಯ ಮತ್ತು ಘನತೆ'
    ]
  },
  vision: {
    statement: 'ಪಾರದರ್ಶಕ, ಭ್ರಷ್ಟಾಚಾರ-ಮುಕ್ತ ಮತ್ತು ಜನಸ್ನೇಹಿ ಆಡಳಿತವುಳ್ಳ ಕರ್ನಾಟಕ ಮತ್ತು ಭಾರತವನ್ನು ನಿರ್ಮಿಸುವುದು.'
  },
  mission: {
    statement: 'ಪ್ರತಿ ಪ್ರಜೆಗೂ ಘನತೆಯ ಬದುಕು, ಪ್ರತಿ ಯುವಕನಿಗೂ ಅವಕಾಶ, ಮತ್ತು ಪ್ರತಿ ನಿರ್ಧಾರದಲ್ಲೂ ಹೊಣೆಗಾರಿಕೆ ಇರುವ ಆಡಳಿತ ವ್ಯವಸ್ಥೆಯನ್ನು ರೂಪಿಸುವುದು.'
  },
  leadership: { members: [] },
  gallery: {
    images: [
      '/images/logo.jpg | RJP ಅಧಿಕೃತ ಲೋಗೋ',
      '/images/flag.jpg | RJP ಧ್ವಜ ಹಾರಾಡುತ್ತಿದೆ',
      '/images/agenda-poster.jpg | RJP ಅಭಿಯಾನ ಪೋಸ್ಟರ್'
    ]
  },
  news: { items: [] },
  contact: {
    website: 'https://www.rjpindia.com',
    email: 'rjpkarnataka@gmail.com',
    phone: '1800 123 2024',
    whatsapp_link: 'https://chat.whatsapp.com/DAfOFN7Dgaz8vxCm77Lncv'
  }
};

const CMS_SECTIONS = {
  banner: {
    title: 'Homepage Banner',
    fields: [
      { name: 'heading', label: 'Hero Heading', type: 'text' },
      { name: 'lede', label: 'Hero Subtext', type: 'textarea' },
      { name: 'slides', label: 'Slides — one per line: image-path | alt text', type: 'lines' }
    ]
  },
  about: {
    title: 'About',
    fields: [
      { name: 'eyebrow', label: 'Eyebrow Label', type: 'text' },
      { name: 'heading', label: 'Heading', type: 'text' },
      { name: 'body', label: 'Body — one paragraph per line', type: 'lines' },
      { name: 'pillars', label: 'Pillars — one per line', type: 'lines' }
    ]
  },
  vision: { title: 'Vision', fields: [{ name: 'statement', label: 'Vision Statement', type: 'textarea' }] },
  mission: { title: 'Mission', fields: [{ name: 'statement', label: 'Mission Statement', type: 'textarea' }] },
  leadership: {
    title: 'Leadership',
    fields: [{ name: 'members', label: 'Leaders — one per line: name | designation | photo-path', type: 'lines' }]
  },
  gallery: {
    title: 'Gallery',
    fields: [{ name: 'images', label: 'Images — one per line: image-path | caption', type: 'lines' }]
  },
  news: {
    title: 'News',
    fields: [{ name: 'items', label: 'News — one per line: date | title | body', type: 'lines' }]
  },
  contact: {
    title: 'Contact',
    fields: [
      { name: 'website', label: 'Website', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'phone', label: 'Helpline Phone', type: 'text' },
      { name: 'whatsapp_link', label: 'WhatsApp Community Link', type: 'text' }
    ]
  }
};

const CMS_KEYS = Object.keys(CMS_SECTIONS);

async function getCmsSection(section) {
  const defaults = CMS_DEFAULTS[section] || {};
  const row = await db.get('SELECT data FROM cms_content WHERE section = ?', [section]);
  if (!row) return defaults;
  try {
    return { ...defaults, ...JSON.parse(row.data) };
  } catch (e) {
    return defaults;
  }
}

async function saveCmsSection(section, data) {
  await db.run(
    `INSERT INTO cms_content (section, data, updated_at) VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = VALUES(updated_at)`,
    [section, JSON.stringify(data)]
  );
}

function parseLine(line, keys) {
  const parts = String(line).split('|').map((s) => s.trim());
  const obj = {};
  keys.forEach((k, i) => { obj[k] = parts[i] || ''; });
  return obj;
}

module.exports = { CMS_SECTIONS, CMS_KEYS, CMS_DEFAULTS, getCmsSection, saveCmsSection, parseLine };
