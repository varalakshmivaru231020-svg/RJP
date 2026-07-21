const fs = require('fs');
const express = require('express');
const path = require('path');
const db = require('../db');
const { donationUpload } = require('../lib/upload');

const router = express.Router();

const DONATION_PURPOSES = [
  'ಸಾಮಾನ್ಯ ಪಕ್ಷ ನಿಧಿ',
  'ಸಾರ್ವಜನಿಕ ಜಾಗೃತಿ',
  'ಸಾಮಾಜಿಕ ಸೇವೆ',
  'ಯುವ ಸಬಲೀಕರಣ',
  'ಮಹಿಳಾ ಸಬಲೀಕರಣ',
  'ಸಂಶೋಧನೆ ಮತ್ತು ತರಬೇತಿ',
  'ಇತರೆ'
];

const EMPTY_OLD = {
  fullName: '', email: '', mobile: '', pan: '', amount: '', purpose: '', remarks: ''
};

function collectOld(body) {
  const old = {};
  for (const key of Object.keys(EMPTY_OLD)) old[key] = body[key] || '';
  return old;
}

router.get('/donate', (req, res) => {
  res.render('donate', {
    page: 'donate',
    meta: { title: 'ಪಕ್ಷಕ್ಕೆ ದೇಣಿಗೆ ನೀಡಿ | RJP' },
    purposes: DONATION_PURPOSES,
    error: null,
    success: false,
    old: { ...EMPTY_OLD }
  });
});

router.post('/donate', (req, res, next) => {
  donationUpload.single('paymentProof')(req, res, async (uploadErr) => {
    try {
      const old = collectOld(req.body);
      const fail = (message) => {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).render('donate', {
          page: 'donate',
          meta: { title: 'ಪಕ್ಷಕ್ಕೆ ದೇಣಿಗೆ ನೀಡಿ | RJP' },
          purposes: DONATION_PURPOSES,
          error: message,
          success: false,
          old
        });
      };

      if (uploadErr) return fail(uploadErr.message);

      const { fullName, email, mobile, pan, amount, purpose, remarks, declaration } = req.body;

      if (!fullName || !fullName.trim()) return fail('ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) return fail('ಸರಿಯಾದ ಇಮೇಲ್ ವಿಳಾಸ ನಮೂದಿಸಿ.');
      if (!/^[0-9]{10}$/.test(mobile || '')) return fail('ಸರಿಯಾದ 10 ಅಂಕಿಗಳ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.');

      const amt = parseInt(amount, 10);
      if (!Number.isFinite(amt) || amt < 1) return fail('ಸರಿಯಾದ ದೇಣಿಗೆ ಮೊತ್ತ ನಮೂದಿಸಿ.');

      if (!DONATION_PURPOSES.includes(purpose)) return fail('ದೇಣಿಗೆಯ ಉದ್ದೇಶ ಆಯ್ಕೆಮಾಡಿ.');
      if (!req.file) return fail('ಪಾವತಿ ಪುರಾವೆ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.');
      if (!declaration) return fail('ಮುಂದುವರಿಯಲು ಘೋಷಣೆಯನ್ನು ಒಪ್ಪಿಕೊಳ್ಳಬೇಕು.');

      await db.run(
        `INSERT INTO donations
          (full_name, email, mobile, pan, amount, purpose, payment_proof_path, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fullName.trim(), email.trim(), mobile, pan ? pan.trim().toUpperCase() : null, amt, purpose,
          path.basename(req.file.path), remarks ? remarks.trim() : null
        ]
      );

      res.render('donate', {
        page: 'donate',
        meta: { title: 'ಪಕ್ಷಕ್ಕೆ ದೇಣಿಗೆ ನೀಡಿ | RJP' },
        purposes: DONATION_PURPOSES,
        error: null,
        success: true,
        old: { ...EMPTY_OLD }
      });
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
