const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const db = require('./db');
const memberRoutes = require('./routes/member');
const adminRoutes = require('./routes/admin');
const donationRoutes = require('./routes/donations');
const { getCmsSection, parseLine } = require('./lib/cms');
const { getSetting } = require('./lib/settings');
const { cardQrDataUrl } = require('./lib/qr');
const asyncHandler = require('./lib/asyncHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'assets')));

const sessionStore = new MySQLStore({
  createDatabaseTable: true,
  expiration: 1000 * 60 * 60 * 8,
  clearExpired: true,
  checkExpirationInterval: 1000 * 60 * 15
}, db);

app.set('trust proxy', 1);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'rjp-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production'
  }
}));

app.use(asyncHandler(async (req, res, next) => {
  res.locals.isMemberLoggedIn = Boolean(req.session.memberId);
  res.locals.themeColor = await getSetting('primary_color');
  next();
}));

const PAGE_META = {
  home: { title: 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP) | Rashtriya Janahita Party' },
  about: { title: 'ನಮ್ಮ ಬಗ್ಗೆ | RJP' },
  ideology: { title: 'ಸಿದ್ಧಾಂತ | RJP' },
  agenda: { title: 'ಅಜೆಂಡಾ | RJP' },
  wings: { title: 'ಘಟಕಗಳು | RJP' },
  transparency: { title: 'ಪಾರದರ್ಶಕತೆ | RJP' },
  gallery: { title: 'ಫೋಟೋ ಗ್ಯಾಲರಿ | RJP' },
  join: { title: 'Join RJP | ಸದಸ್ಯತ್ವ' },
  contact: { title: 'ಸಂಪರ್ಕ | RJP' },
  'karnataka-president': { title: 'ಕರ್ನಾಟಕ ರಾಜ್ಯಾಧ್ಯಕ್ಷರ ನೇಮಕಾತಿ | RJP' },
  'karnataka-president-message': { title: 'ನೂತನ ರಾಜ್ಯಾಧ್ಯಕ್ಷ ವೀರೇಂದ್ರಬಾಬು ನಂಜೇಗೌಡರ ಸಂದೇಶ | RJP' }
};

function renderPage(page) {
  return (req, res) => res.render(page, { page, meta: PAGE_META[page] });
}

// Sample data for the membership card preview shown on the public home and
// join pages (not a real member) — keeps that preview rendered from the
// same partial as the real card, so it never drifts from the live design.
const CARD_PREVIEW_MEMBER = {
  full_name: 'Your Name',
  application_number: 'RJP2024XXXXXX',
  district: 'Your District',
  assembly: 'Your Constituency',
  created_at: '2024-00-00 00:00:00',
  photo_path: null
};
async function cardPreviewLocals(req) {
  return {
    previewMember: CARD_PREVIEW_MEMBER,
    previewQrDataUrl: await cardQrDataUrl(req, CARD_PREVIEW_MEMBER.application_number)
  };
}

app.get('/', asyncHandler(async (req, res) => {
  const banner = await getCmsSection('banner');
  res.render('home', {
    page: 'home',
    meta: PAGE_META.home,
    banner: { ...banner, slides: banner.slides.map((line) => parseLine(line, ['image', 'alt'])) },
    ...(await cardPreviewLocals(req))
  });
}));
app.get('/about', renderPage('about'));
app.get('/ideology', renderPage('ideology'));
app.get('/agenda', renderPage('agenda'));
app.get('/wings', renderPage('wings'));
app.get('/transparency', renderPage('transparency'));
app.get('/gallery', renderPage('gallery'));
app.get('/join', asyncHandler(async (req, res) => {
  res.render('join', { page: 'join', meta: PAGE_META.join, ...(await cardPreviewLocals(req)) });
}));
app.get('/karnataka-president', renderPage('karnataka-president'));
app.get('/karnataka-president-message', renderPage('karnataka-president-message'));
app.get('/contact', asyncHandler(async (req, res) => {
  res.render('contact', { page: 'contact', meta: PAGE_META.contact, contact: await getCmsSection('contact') });
}));

app.use('/', memberRoutes);
app.use('/', adminRoutes);
app.use('/', donationRoutes);

app.use((req, res) => {
  res.status(404).render('404', { page: '', meta: { title: 'Page Not Found | RJP' } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong. Please try again shortly.');
});

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`RJP website running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
