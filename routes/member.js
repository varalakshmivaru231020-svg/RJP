const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { upload, PHOTO_DIR } = require('../lib/upload');
const { nextApplicationNumber } = require('../lib/applicationNumber');
const { KARNATAKA_DISTRICTS, AREAS_OF_INTEREST, STATUS_ORDER } = require('../lib/constants');
const { cardQrDataUrl, cardQrBuffer } = require('../lib/qr');
const { streamCardPdf } = require('../lib/cardPdf');
const { getCmsSection, parseLine } = require('../lib/cms');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

const FORM_FIELDS = [
  'fullName', 'guardianName', 'dob', 'gender', 'mobile', 'whatsapp', 'email', 'aadhaar', 'address',
  'state', 'district', 'taluk', 'assembly', 'parliament', 'ward', 'booth',
  'occupation', 'education', 'religion', 'caste', 'subCaste', 'socialMedia'
];

function collectOld(body) {
  const old = {};
  for (const key of FORM_FIELDS) old[key] = body[key] || '';
  old.areasOfInterest = [].concat(body.areasOfInterest || []);
  return old;
}

function requireMemberAuth(req, res, next) {
  if (!req.session.memberId) return res.redirect('/login');
  next();
}

router.get('/register', (req, res) => {
  if (req.session.memberId) return res.redirect('/dashboard');
  res.render('register', {
    page: 'register',
    meta: { title: 'Become a Member | RJP' },
    districts: KARNATAKA_DISTRICTS,
    interests: AREAS_OF_INTEREST,
    error: null,
    old: collectOld({})
  });
});

router.post('/register', (req, res, next) => {
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'idUpload', maxCount: 1 }])(req, res, async (uploadErr) => {
   try {
    const old = collectOld(req.body);
    const fail = (message) => {
      // Clean up any files saved before validation failed
      for (const f of [].concat(req.files?.photo || [], req.files?.idUpload || [])) {
        fs.unlink(f.path, () => {});
      }
      return res.status(400).render('register', {
        page: 'register',
        meta: { title: 'Become a Member | RJP' },
        districts: KARNATAKA_DISTRICTS,
        interests: AREAS_OF_INTEREST,
        error: message,
        old
      });
    };

    if (uploadErr) return fail(uploadErr.message);

    const { fullName, mobile, password, confirmPassword, declaration } = req.body;

    if (!fullName || !fullName.trim()) return fail('Full name is required.');
    if (!/^[0-9]{10}$/.test(mobile || '')) return fail('Enter a valid 10-digit mobile number.');
    if (!password || password.length < 6) return fail('Password must be at least 6 characters.');
    if (password !== confirmPassword) return fail('Passwords do not match.');
    if (!declaration) return fail('You must accept the declaration to continue.');

    const existing = await db.get('SELECT id FROM members WHERE mobile = ?', [mobile]);
    if (existing) return fail('An application already exists with this mobile number. Please login instead.');

    const photoFile = req.files?.photo?.[0];
    const idFile = req.files?.idUpload?.[0];

    const applicationNumber = await nextApplicationNumber(db);
    const passwordHash = bcrypt.hashSync(password, 10);

    const columns = [
      'application_number', 'full_name', 'guardian_name', 'dob', 'gender', 'mobile', 'whatsapp', 'email', 'aadhaar', 'address',
      'state', 'district', 'taluk', 'assembly', 'parliament', 'ward', 'booth',
      'occupation', 'education', 'religion', 'caste', 'sub_caste', 'areas_of_interest', 'social_media',
      'photo_path', 'id_upload_path', 'declaration_accepted', 'password_hash', 'status'
    ];
    const values = [
      applicationNumber, fullName.trim(), old.guardianName || null, old.dob || null, old.gender || null, mobile,
      old.whatsapp || null, old.email || null, old.aadhaar || null, old.address || null,
      old.state || 'Karnataka', old.district || null, old.taluk || null, old.assembly || null, old.parliament || null, old.ward || null, old.booth || null,
      old.occupation || null, old.education || null, old.religion || null, old.caste || null, old.subCaste || null, old.areasOfInterest.join(', '), old.socialMedia || null,
      photoFile ? path.basename(photoFile.path) : null, idFile ? path.basename(idFile.path) : null,
      1, passwordHash, 'Pending Approval'
    ];

    try {
      const result = await db.run(
        `INSERT INTO members (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
        values
      );
      await db.run(
        'INSERT INTO member_activity (member_id, action, note) VALUES (?, ?, ?)',
        [result.insertId, 'Application Submitted', 'Registered via public membership form']
      );
    } catch (e) {
      return fail('Something went wrong saving your application. Please try again.');
    }

    res.render('register-success', {
      page: 'register-success',
      meta: { title: 'Application Submitted | RJP' },
      applicationNumber
    });
   } catch (err) {
     next(err);
   }
  });
});

router.get('/login', (req, res) => {
  if (req.session.memberId) return res.redirect('/dashboard');
  res.render('login', { page: 'login', meta: { title: 'Member Login | RJP' }, error: null });
});

router.post('/login', asyncHandler(async (req, res) => {
  const { mobile, password } = req.body;
  const member = await db.get('SELECT * FROM members WHERE mobile = ?', [(mobile || '').trim()]);

  if (!member || !bcrypt.compareSync(password || '', member.password_hash)) {
    return res.status(401).render('login', {
      page: 'login',
      meta: { title: 'Member Login | RJP' },
      error: 'Invalid mobile number or password.'
    });
  }

  req.session.memberId = member.id;
  res.redirect('/dashboard');
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

const PROFILE_CHECKLIST = [
  { key: 'photo_path', label: 'Photo Upload' },
  { key: 'id_upload_path', label: 'ID Upload' },
  { key: 'whatsapp', label: 'WhatsApp Number' },
  { key: 'email', label: 'Email' },
  { key: 'aadhaar', label: 'Aadhaar Number' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'social_media', label: 'Social Media' },
  { key: 'guardian_name', label: 'Father/Mother Name' }
];

router.get('/dashboard', requireMemberAuth, asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.session.memberId]);
  if (!member) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }

  const isRejected = member.status === 'Rejected';
  const statusIndex = isRejected ? 0 : STATUS_ORDER.indexOf(member.status);
  const progress = STATUS_ORDER.map((label, i) => ({
    label,
    done: isRejected ? i === 0 : i <= statusIndex
  }));

  const checklist = PROFILE_CHECKLIST.map((item) => ({ label: item.label, done: Boolean(member[item.key]) }));
  const profileCompletion = Math.round((checklist.filter((c) => c.done).length / checklist.length) * 100);

  const activity = await db.all(
    'SELECT action, note, created_at FROM member_activity WHERE member_id = ? ORDER BY created_at DESC, id DESC LIMIT 10',
    [member.id]
  );

  const newsSection = await getCmsSection('news');
  const announcements = (newsSection.items || [])
    .map((line) => parseLine(line, ['date', 'title', 'body']))
    .slice(0, 3);

  res.render('dashboard', {
    page: 'dashboard',
    meta: { title: 'My Dashboard | RJP' },
    member,
    progress,
    statusIndex,
    isRejected,
    checklist,
    profileCompletion,
    activity,
    announcements
  });
}));

const PROFILE_EDIT_FIELDS = [
  'guardianName', 'dob', 'gender', 'whatsapp', 'email', 'aadhaar', 'address',
  'district', 'taluk', 'assembly', 'occupation', 'education', 'socialMedia'
];
const PROFILE_EDIT_COLUMNS = {
  guardianName: 'guardian_name', dob: 'dob', gender: 'gender', whatsapp: 'whatsapp',
  email: 'email', aadhaar: 'aadhaar', address: 'address', district: 'district',
  taluk: 'taluk', assembly: 'assembly', occupation: 'occupation', education: 'education',
  socialMedia: 'social_media'
};

router.get('/dashboard/profile', requireMemberAuth, asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.session.memberId]);
  if (!member) return res.redirect('/login');
  res.render('profile', {
    page: 'profile',
    meta: { title: 'My Profile | RJP' },
    member,
    districts: KARNATAKA_DISTRICTS,
    updated: req.query.updated === '1'
  });
}));

router.post('/dashboard/profile', requireMemberAuth, asyncHandler(async (req, res) => {
  const setClauses = PROFILE_EDIT_FIELDS.map((f) => `${PROFILE_EDIT_COLUMNS[f]} = ?`);
  const values = PROFILE_EDIT_FIELDS.map((f) => req.body[f] || null);
  values.push(req.session.memberId);

  await db.run(`UPDATE members SET ${setClauses.join(', ')} WHERE id = ?`, values);
  await db.run(
    'INSERT INTO member_activity (member_id, action, note) VALUES (?, ?, ?)',
    [req.session.memberId, 'Profile Updated', 'Updated via member portal']
  );

  res.redirect('/dashboard/profile?updated=1');
}));

router.get('/my-photo', requireMemberAuth, asyncHandler(async (req, res) => {
  const member = await db.get('SELECT photo_path FROM members WHERE id = ?', [req.session.memberId]);
  if (!member || !member.photo_path) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, member.photo_path));
}));

router.get('/dashboard/card', requireMemberAuth, asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.session.memberId]);
  if (!member) return res.redirect('/login');
  const qrDataUrl = await cardQrDataUrl(req, member.application_number);
  res.render('member-card', {
    page: 'member-card',
    meta: { title: 'My Membership Card | RJP' },
    member,
    qrDataUrl,
    backUrl: '/dashboard',
    downloadPdfUrl: '/dashboard/card/pdf'
  });
}));

router.get('/dashboard/card/pdf', requireMemberAuth, asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.session.memberId]);
  if (!member) return res.redirect('/login');
  const qrBuffer = await cardQrBuffer(req, member.application_number);
  await streamCardPdf(res, member, qrBuffer);
}));

router.get('/verify/:applicationNumber', asyncHandler(async (req, res) => {
  const member = await db.get(`
    SELECT application_number, full_name, district, assembly, status, created_at
    FROM members WHERE application_number = ?
  `, [req.params.applicationNumber]);
  res.render('verify', {
    page: 'verify',
    meta: { title: 'Verify Membership | RJP' },
    member: member || null
  });
}));

module.exports = router;
