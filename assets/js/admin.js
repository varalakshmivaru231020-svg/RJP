document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('adminMenuBtn');
  const sidebar = document.querySelector('.admin-sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn) {
        sidebar.classList.remove('open');
      }
    });
  }

  document.querySelectorAll('.admin-tabs').forEach((tabBar) => {
    const buttons = tabBar.querySelectorAll('button');
    const panelWrap = tabBar.parentElement;
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        panelWrap.querySelectorAll('.admin-tab-panel').forEach((panel) => {
          panel.classList.toggle('active', panel.dataset.tab === btn.dataset.tab);
        });
      });
    });
  });

  document.querySelectorAll('[data-confirm]').forEach((el) => {
    el.addEventListener('submit', (e) => {
      if (!window.confirm(el.dataset.confirm)) e.preventDefault();
    });
  });
});
