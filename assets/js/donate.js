document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('donationForm');
  if (!form) return;

  // Quick amount buttons
  const amountInput = document.getElementById('donationAmountInput');
  const quickRow = document.getElementById('amountQuickRow');
  if (amountInput && quickRow) {
    const chips = Array.from(quickRow.querySelectorAll('.amount-chip'));
    function syncActiveChip() {
      chips.forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.amount === amountInput.value);
      });
    }
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        if (chip.dataset.amount === 'custom') {
          chips.forEach((c) => c.classList.remove('active'));
          chip.classList.add('active');
          amountInput.value = '';
          amountInput.focus();
          return;
        }
        amountInput.value = chip.dataset.amount;
        syncActiveChip();
      });
    });
    amountInput.addEventListener('input', syncActiveChip);
    syncActiveChip();
  }

  // Copy-to-clipboard for bank details
  document.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = btn.dataset.copyValue || '';
      try {
        await navigator.clipboard.writeText(value);
      } catch (e) {
        const temp = document.createElement('textarea');
        temp.value = value;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      const original = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove('copied');
      }, 1500);
    });
  });

  // Drag-and-drop payment proof upload
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('paymentProofInput');
  const dropzoneText = document.getElementById('dropzoneText');
  if (dropzone && fileInput && dropzoneText) {
    function showFileName() {
      if (fileInput.files && fileInput.files[0]) {
        dropzoneText.textContent = fileInput.files[0].name;
        dropzone.classList.add('has-file');
      } else {
        dropzoneText.textContent = 'ಫೈಲ್ ಎಳೆದು ಬಿಡಿ ಅಥವಾ ಆಯ್ಕೆಮಾಡಲು ಕ್ಲಿಕ್ ಮಾಡಿ';
        dropzone.classList.remove('has-file');
      }
    }
    fileInput.addEventListener('change', showFileName);

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        fileInput.files = e.dataTransfer.files;
        showFileName();
      }
    });
  }

  // Submit spinner
  const submitBtn = document.getElementById('donationSubmitBtn');
  form.addEventListener('submit', () => {
    if (!form.checkValidity()) return;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;
  });
});
