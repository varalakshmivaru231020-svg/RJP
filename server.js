const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'assets')));

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

app.get('/', renderPage('home'));
app.get('/about', renderPage('about'));
app.get('/ideology', renderPage('ideology'));
app.get('/agenda', renderPage('agenda'));
app.get('/wings', renderPage('wings'));
app.get('/transparency', renderPage('transparency'));
app.get('/gallery', renderPage('gallery'));
app.get('/join', renderPage('join'));
app.get('/contact', renderPage('contact'));

app.use((req, res) => {
  res.status(404).render('404', { page: '', meta: { title: 'Page Not Found | RJP' } });
});

app.listen(PORT, () => {
  console.log(`RJP website running at http://localhost:${PORT}`);
});
