const express = require('express');
const path = require('path');
const session = require('express-session');

const memberRoutes = require('./routes/member');
const adminRoutes = require('./routes/admin');
const { getCmsSection, parseLine } = require('./lib/cms');
const { getSetting } = require('./lib/settings');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'assets')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'rjp-dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use((req, res, next) => {
  res.locals.isMemberLoggedIn = Boolean(req.session.memberId);
  res.locals.themeColor = getSetting('primary_color');
  next();
});

const PAGE_META = {
  home: { title: 'ರಾಷ್ಟ್ರೀಯ ಜನಹಿತ ಪಕ್ಷ (RJP) | Rashtriya Janahita Party' },
  about: { title: 'ನಮ್ಮ ಬಗ್ಗೆ | RJP' },
  ideology: { title: 'ಸಿದ್ಧಾಂತ | RJP' },
  agenda: { title: 'ಅಜೆಂಡಾ | RJP' },
  wings: { title: 'ಘಟಕಗಳು | RJP' },
  transparency: { title: 'ಪಾರದರ್ಶಕತೆ | RJP' },
  gallery: { title: 'ಫೋಟೋ ಗ್ಯಾಲರಿ | RJP' },
  join: { title: 'Join RJP | ಸದಸ್ಯತ್ವ' },
  contact: { title: 'ಸಂಪರ್ಕ | RJP' }
};

function renderPage(page) {
  return (req, res) => res.render(page, { page, meta: PAGE_META[page] });
}

app.get('/', (req, res) => {
  const banner = getCmsSection('banner');
  res.render('home', {
    page: 'home',
    meta: PAGE_META.home,
    banner: { ...banner, slides: banner.slides.map((line) => parseLine(line, ['image', 'alt'])) }
  });
});
app.get('/about', renderPage('about'));
app.get('/ideology', renderPage('ideology'));
app.get('/agenda', renderPage('agenda'));
app.get('/wings', renderPage('wings'));
app.get('/transparency', renderPage('transparency'));
app.get('/gallery', renderPage('gallery'));
app.get('/join', renderPage('join'));
app.get('/contact', (req, res) => {
  res.render('contact', { page: 'contact', meta: PAGE_META.contact, contact: getCmsSection('contact') });
});

app.use('/', memberRoutes);
app.use('/', adminRoutes);

app.use((req, res) => {
  res.status(404).render('404', { page: '', meta: { title: 'Page Not Found | RJP' } });
});

app.listen(PORT, () => {
  console.log(`RJP website running at http://localhost:${PORT}`);
});
