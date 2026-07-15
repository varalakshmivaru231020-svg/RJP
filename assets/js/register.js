document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const districtSelect = document.getElementById('districtSelect');
  const talukSelect = document.getElementById('talukSelect');
  if (districtSelect && talukSelect && window.RJP_TALUKS) {
    function populateTaluks(preserveSelected) {
      const taluks = window.RJP_TALUKS[districtSelect.value] || [];
      const selected = preserveSelected ? talukSelect.dataset.selected : '';
      talukSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = taluks.length ? 'ಆಯ್ಕೆಮಾಡಿ' : 'ಮೊದಲು ಜಿಲ್ಲೆ ಆಯ್ಕೆಮಾಡಿ';
      talukSelect.appendChild(placeholder);
      taluks.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === selected) opt.selected = true;
        talukSelect.appendChild(opt);
      });
    }
    populateTaluks(true);
    districtSelect.addEventListener('change', () => populateTaluks(false));
  }

  const panels = Array.from(form.querySelectorAll('.wizard-panel'));
  const steps = Array.from(document.querySelectorAll('#wizardSteps li'));

  function showStep(n) {
    panels.forEach((panel) => panel.classList.toggle('active', Number(panel.dataset.panel) === n));
    steps.forEach((step) => {
      const stepNum = Number(step.dataset.step);
      step.classList.toggle('active', stepNum === n);
      step.classList.toggle('done', stepNum < n);
    });
    window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
  }

  form.querySelectorAll('.wizard-next').forEach((btn) => {
    btn.addEventListener('click', () => {
      const currentPanel = btn.closest('.wizard-panel');
      const invalid = currentPanel.querySelector(':invalid');
      if (invalid) {
        invalid.reportValidity();
        return;
      }
      const password = currentPanel.querySelector('[name="password"]');
      const confirm = currentPanel.querySelector('[name="confirmPassword"]');
      if (password && confirm && password.value !== confirm.value) {
        confirm.setCustomValidity('ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ');
        confirm.reportValidity();
        return;
      }
      if (confirm) confirm.setCustomValidity('');
      const current = Number(currentPanel.dataset.panel);
      showStep(current + 1);
    });
  });

  form.querySelectorAll('.wizard-prev').forEach((btn) => {
    btn.addEventListener('click', () => {
      const current = Number(btn.closest('.wizard-panel').dataset.panel);
      showStep(current - 1);
    });
  });
});
