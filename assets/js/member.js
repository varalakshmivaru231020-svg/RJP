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

  const activityToggle = document.getElementById('mpActivityToggle');
  const activityList = document.getElementById('mpActivityList');
  function expandActivity() {
    if (!activityList) return;
    activityList.removeAttribute('data-collapsed');
    if (activityToggle) activityToggle.textContent = 'Show Less';
  }
  if (activityToggle && activityList) {
    activityToggle.addEventListener('click', () => {
      const collapsed = activityList.hasAttribute('data-collapsed');
      if (collapsed) {
        expandActivity();
      } else {
        activityList.setAttribute('data-collapsed', '');
        activityToggle.textContent = 'View All';
      }
    });
  }
  if (window.location.hash === '#mp-notifications') expandActivity();

  const bell = document.getElementById('mpBell');
  if (bell) {
    bell.addEventListener('click', () => {
      const target = document.getElementById('mp-notifications');
      if (target) {
        expandActivity();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.href = '/dashboard#mp-notifications';
      }
    });
  }

  const profileForm = document.getElementById('mpProfileForm');
  const profileEditBtn = document.getElementById('mpProfileEditBtn');
  const profileFormActions = document.getElementById('mpProfileFormActions');
  const profileCancelBtn = document.getElementById('mpProfileCancelBtn');
  if (profileForm && profileEditBtn) {
    profileEditBtn.addEventListener('click', () => {
      profileForm.classList.remove('mode-view');
      profileForm.classList.add('mode-edit');
      profileForm.querySelectorAll('input, select, textarea').forEach((el) => {
        el.removeAttribute('readonly');
        el.removeAttribute('disabled');
      });
      profileEditBtn.style.display = 'none';
      if (profileFormActions) profileFormActions.style.display = 'flex';
    });
    if (profileCancelBtn) {
      profileCancelBtn.addEventListener('click', () => window.location.reload());
    }
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
