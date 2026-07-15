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

router.post('/register', (req, res) => {
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'idUpload', maxCount: 1 }])(req, res, (uploadErr) => {
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

    const existing = db.prepare('SELECT id FROM members WHERE mobile = ?').get(mobile);
    if (existing) return fail('An application already exists with this mobile number. Please login instead.');

    const photoFile = req.files?.photo?.[0];
    const idFile = req.files?.idUpload?.[0];

    const applicationNumber = nextApplicationNumber(db);
    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      db.prepare(`
        INSERT INTO members (
          application_number, full_name, guardian_name, dob, gender, mobile, whatsapp, email, aadhaar, address,
          state, district, taluk, assembly, parliament, ward, booth,
          occupation, education, religion, caste, sub_caste, areas_of_interest, social_media,
          photo_path, id_upload_path, declaration_accepted, password_hash, status
        ) VALUES (
          @application_number, @full_name, @guardian_name, @dob, @gender, @mobile, @whatsapp, @email, @aadhaar, @address,
          @state, @district, @taluk, @assembly, @parliament, @ward, @booth,
          @occupation, @education, @religion, @caste, @sub_caste, @areas_of_interest, @social_media,
          @photo_path, @id_upload_path, @declaration_accepted, @password_hash, @status
        )
      `).run({
        application_number: applicationNumber,
        full_name: fullName.trim(),
        guardian_name: old.guardianName || null,
        dob: old.dob || null,
        gender: old.gender || null,
        mobile,
        whatsapp: old.whatsapp || null,
        email: old.email || null,
        aadhaar: old.aadhaar || null,
        address: old.address || null,
        state: old.state || 'Karnataka',
        district: old.district || null,
        taluk: old.taluk || null,
        assembly: old.assembly || null,
        parliament: old.parliament || null,
        ward: old.ward || null,
        booth: old.booth || null,
        occupation: old.occupation || null,
        education: old.education || null,
        religion: old.religion || null,
        caste: old.caste || null,
        sub_caste: old.subCaste || null,
        areas_of_interest: old.areasOfInterest.join(', '),
        social_media: old.socialMedia || null,
        photo_path: photoFile ? path.basename(photoFile.path) : null,
        id_upload_path: idFile ? path.basename(idFile.path) : null,
        declaration_accepted: 1,
        password_hash: passwordHash,
        status: 'Pending Approval'
      });

      const newMemberId = db.prepare('SELECT id FROM members WHERE application_number = ?').get(applicationNumber).id;
      db.prepare('INSERT INTO member_activity (member_id, action, note) VALUES (?, ?, ?)')
        .run(newMemberId, 'Application Submitted', 'Registered via public membership form');
    } catch (e) {
      return fail('Something went wrong saving your application. Please try again.');
    }

    res.render('register-success', {
      page: 'register-success',
      meta: { title: 'Application Submitted | RJP' },
      applicationNumber
    });
  });
});

router.get('/login', (req, res) => {
  if (req.session.memberId) return res.redirect('/dashboard');
  res.render('login', { page: 'login', meta: { title: 'Member Login | RJP' }, error: null });
});

router.post('/login', (req, res) => {
  const { mobile, password } = req.body;
  const member = db.prepare('SELECT * FROM members WHERE mobile = ?').get((mobile || '').trim());

  if (!member || !bcrypt.compareSync(password || '', member.password_hash)) {
    return res.status(401).render('login', {
      page: 'login',
      meta: { title: 'Member Login | RJP' },
      error: 'Invalid mobile number or password.'
    });
  }

  req.session.memberId = member.id;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/dashboard', requireMemberAuth, (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.session.memberId);
  if (!member) {
    req.session.destroy(() => res.redirect('/login'));
    return;
  }

  const statusIndex = STATUS_ORDER.indexOf(member.status);
  const progress = STATUS_ORDER.map((label, i) => ({
    label,
    done: member.status === 'Rejected' ? i === 0 : i <= statusIndex
  }));

  res.render('dashboard', {
    page: 'dashboard',
    meta: { title: 'My Dashboard | RJP' },
    member,
    progress
  });
});

router.get('/my-photo', requireMemberAuth, (req, res) => {
  const member = db.prepare('SELECT photo_path FROM members WHERE id = ?').get(req.session.memberId);
  if (!member || !member.photo_path) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, member.photo_path));
});

router.get('/dashboard/card', requireMemberAuth, async (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.session.memberId);
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
});

router.get('/dashboard/card/pdf', requireMemberAuth, async (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.session.memberId);
  if (!member) return res.redirect('/login');
  const qrBuffer = await cardQrBuffer(req, member.application_number);
  streamCardPdf(res, member, qrBuffer);
});

router.get('/verify/:applicationNumber', (req, res) => {
  const member = db.prepare(`
    SELECT application_number, full_name, district, assembly, status, created_at
    FROM members WHERE application_number = ?
  `).get(req.params.applicationNumber);
  res.render('verify', {
    page: 'verify',
    meta: { title: 'Verify Membership | RJP' },
    member: member || null
  });
});

module.exports = router;
