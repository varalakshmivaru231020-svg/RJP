document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const mbtn = document.querySelector('.menu-btn');
  const mnav = document.getElementById('mnav');
  if (mbtn && mnav) {
    mbtn.addEventListener('click', () => {
      mnav.style.display = (mnav.style.display === 'none' || !mnav.style.display) ? 'flex' : 'none';
    });
  }

  function makeSlider(root, { slideSel, dotsSel, activeClass, interval }) {
    if (!root) return;
    const slides = root.querySelectorAll(slideSel);
    const dotsWrap = root.querySelector(dotsSel);
    if (!slides.length || !dotsWrap) return;
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'ಚಿತ್ರ ' + (i + 1));
      dotsWrap.appendChild(dot);
    });
    const dots = dotsWrap.querySelectorAll('.dot');
    let idx = 0, timer;
    function show(i) {
      slides[idx].classList.remove(activeClass);
      dots[idx].classList.remove('active');
      idx = (i + slides.length) % slides.length;
      slides[idx].classList.add(activeClass);
      dots[idx].classList.add('active');
    }
    function start() { timer = setInterval(() => show(idx + 1), interval); }
    function restart() { clearInterval(timer); start(); }
    const prevBtn = root.querySelector('.prev');
    const nextBtn = root.querySelector('.next');
    if (prevBtn) prevBtn.addEventListener('click', () => { show(idx - 1); restart(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { show(idx + 1); restart(); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); restart(); }));
    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', start);
    start();
  }

  makeSlider(document.querySelector('.hero'), { slideSel: '.slide', dotsSel: '.hero-dots', activeClass: 'current', interval: 5000 });

  function initGalleryRow(root, dotsWrap) {
    if (!root || !dotsWrap) return;
    const track = root.querySelector('.gallery-row-track');
    const items = track.querySelectorAll('.gallery-row-item');
    if (!items.length) return;
    const step = items[0].getBoundingClientRect().width;
    const visible = Math.max(1, Math.round(root.clientWidth / step));
    const maxIndex = Math.max(0, items.length - visible);
    for (let i = 0; i <= maxIndex; i++) {
      const dot = document.createElement('button');
      dot.className = 'dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'ಗುಂಪು ' + (i + 1));
      dotsWrap.appendChild(dot);
    }
    const dots = dotsWrap.querySelectorAll('.dot');
    let idx = 0, timer;
    function show(i) {
      dots[idx].classList.remove('active');
      idx = i < 0 ? maxIndex : (i > maxIndex ? 0 : i);
      dots[idx].classList.add('active');
      track.style.transform = 'translateX(' + (-idx * step) + 'px)';
    }
    function start() { timer = setInterval(() => show(idx + 1), 2600); }
    function restart() { clearInterval(timer); start(); }
    dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); restart(); }));
    root.addEventListener('mouseenter', () => clearInterval(timer));
    root.addEventListener('mouseleave', start);
    start();
  }
  initGalleryRow(document.getElementById('galleryRow'), document.getElementById('galleryRowDots'));

  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    const lightboxImg = document.getElementById('lightboxImg');
    const closeBtn = document.getElementById('lightboxClose');
    function closeLightbox() {
      lightbox.classList.remove('open');
      lightboxImg.src = '';
    }
    document.querySelectorAll('.gallery-grid a').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        lightboxImg.src = a.getAttribute('href');
        const thumb = a.querySelector('img');
        lightboxImg.alt = thumb ? thumb.alt : '';
        lightbox.classList.add('open');
      });
    });
    closeBtn.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }

  // Scales any .rjp-card-stage (membership card preview, front and/or back)
  // to fit its container width — shared by the dashboard card page and the
  // public /join preview, which can each host one or more stages.
  const CARD_W = 520;
  function fitCardStage(stage) {
    const wrap = stage.querySelector('.rjp-card-wrap');
    if (!wrap) return;
    const active = wrap.querySelector('.rjp-card.active') || wrap.querySelector('.rjp-card');
    const cardHeight = active ? active.offsetHeight : 0;
    const scale = Math.min(1, stage.clientWidth / CARD_W);
    wrap.style.transform = 'scale(' + scale + ')';
    stage.style.height = (cardHeight * scale) + 'px';
  }
  function fitCardStages() {
    document.querySelectorAll('.rjp-card-stage').forEach(fitCardStage);
  }
  if (document.querySelector('.rjp-card-stage')) {
    window.rjpFitCardStages = fitCardStages;
    fitCardStages();
    window.addEventListener('resize', fitCardStages);
    window.addEventListener('beforeprint', () => {
      document.querySelectorAll('.rjp-card-wrap').forEach((w) => { w.style.transform = 'none'; });
      document.querySelectorAll('.rjp-card-stage').forEach((s) => { s.style.height = 'auto'; });
    });
    window.addEventListener('afterprint', fitCardStages);
  }
});
