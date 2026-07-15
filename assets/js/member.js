document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('mpMenuBtn');
  const sidebar = document.querySelector('.mp-sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
        sidebar.classList.remove('open');
      }
    });
  }

  const profileBtn = document.getElementById('mpProfileBtn');
  const profileMenu = document.getElementById('mpProfileMenu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('open');
    });
    document.addEventListener('click', () => profileMenu.classList.remove('open'));
  }

  const bell = document.getElementById('mpBell');
  if (bell) {
    bell.addEventListener('click', () => {
      const target = document.getElementById('mp-notifications');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const activityToggle = document.getElementById('mpActivityToggle');
  const activityList = document.getElementById('mpActivityList');
  if (activityToggle && activityList) {
    activityToggle.addEventListener('click', () => {
      const collapsed = activityList.hasAttribute('data-collapsed');
      if (collapsed) {
        activityList.removeAttribute('data-collapsed');
        activityToggle.textContent = 'Show Less';
      } else {
        activityList.setAttribute('data-collapsed', '');
        activityToggle.textContent = 'View All';
      }
    });
  }

  document.querySelectorAll('.mp-progress-fill').forEach((el) => {
    const target = el.dataset.value || '0';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { el.style.width = `${target}%`; });
    });
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = parseInt(el.dataset.count, 10);
    if (Number.isNaN(target)) return;
    if (prefersReducedMotion) { el.textContent = target.toLocaleString('en-IN'); return; }
    const duration = 700;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      el.textContent = Math.round(progress * target).toLocaleString('en-IN');
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
});
