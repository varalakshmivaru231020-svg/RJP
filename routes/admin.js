const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { upload, PHOTO_DIR, ID_DIR, PAYMENT_DIR } = require('../lib/upload');
const { SETTINGS_DEFAULTS, getAllSettings, setSettings } = require('../lib/settings');
const { KARNATAKA_DISTRICTS, KARNATAKA_TALUKS, AREAS_OF_INTEREST, ALL_STATUSES } = require('../lib/constants');
const { cardQrDataUrl, cardQrBuffer } = require('../lib/qr');
const { streamCardPdf } = require('../lib/cardPdf');
const { streamReportPdf } = require('../lib/reportPdf');
const { streamReportExcel, streamMembersExcel } = require('../lib/reportExcel');
const { CMS_SECTIONS, CMS_KEYS, getCmsSection, saveCmsSection } = require('../lib/cms');
const asyncHandler = require('../lib/asyncHandler');

const router = express.Router();

function requireAdminAuth(req, res, next) {
  if (!req.session.adminId) return res.redirect('/admin/login');
  next();
}

router.get('/admin/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { meta: { title: 'Admin Login | RJP' }, error: null });
});

router.post('/admin/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await db.get('SELECT * FROM admins WHERE email = ?', [(email || '').trim().toLowerCase()]);

  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).render('admin/login', {
      meta: { title: 'Admin Login | RJP' },
      error: 'Invalid email or password.'
    });
  }

  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;
  req.session.adminName = admin.name;
  res.redirect('/admin');
}));

router.post('/admin/logout', (req, res) => {
  req.session.adminId = null;
  req.session.adminEmail = null;
  req.session.adminName = null;
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use('/admin', requireAdminAuth);
router.use('/admin', (req, res, next) => {
  res.locals.admin = { name: req.session.adminName, email: req.session.adminEmail };
  next();
});

router.get('/admin', (req, res) => {
  res.redirect('/admin/dashboard');
});

function trend(curr, prev) {
  if (prev === 0) return { pct: curr > 0 ? 100 : 0, dir: curr > 0 ? 'up' : 'flat' };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : (pct < 0 ? 'down' : 'flat') };
}

async function count(sql, params) {
  const row = await db.get(sql, params);
  return row.n;
}

router.get('/admin/dashboard', asyncHandler(async (req, res) => {
  const total = await count('SELECT COUNT(*) AS n FROM members');
  const pending = await count("SELECT COUNT(*) AS n FROM members WHERE status = 'Pending Approval'");
  const approved = await count("SELECT COUNT(*) AS n FROM members WHERE status IN ('Approved', 'Active')");
  const rejected = await count("SELECT COUNT(*) AS n FROM members WHERE status = 'Rejected'");
  const today = await count('SELECT COUNT(*) AS n FROM members WHERE DATE(created_at) = CURDATE()');
  const underReview = await count("SELECT COUNT(*) AS n FROM members WHERE status = 'Under Review'");

  const regsThisWeek = await count("SELECT COUNT(*) AS n FROM members WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  const regsPrevWeek = await count("SELECT COUNT(*) AS n FROM members WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
  const approvedThisWeek = await count("SELECT COUNT(*) AS n FROM member_activity WHERE action='Approved' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  const approvedPrevWeek = await count("SELECT COUNT(*) AS n FROM member_activity WHERE action='Approved' AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
  const rejectedThisWeek = await count("SELECT COUNT(*) AS n FROM member_activity WHERE action='Rejected' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  const rejectedPrevWeek = await count("SELECT COUNT(*) AS n FROM member_activity WHERE action='Rejected' AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)");
  const yesterday = await count("SELECT COUNT(*) AS n FROM members WHERE DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)");

  const monthlyRows = (await db.all(`
    SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS n
    FROM members GROUP BY ym ORDER BY ym DESC LIMIT 6
  `)).reverse();

  const districtRows = await db.all(`
    SELECT COALESCE(NULLIF(district, ''), 'Unspecified') AS label, COUNT(*) AS n
    FROM members GROUP BY label ORDER BY n DESC LIMIT 8
  `);

  const genderRows = await db.all(`
    SELECT COALESCE(NULLIF(gender, ''), 'Not Specified') AS label, COUNT(*) AS n
    FROM members GROUP BY label ORDER BY n DESC
  `);

  const occupationRows = await db.all(`
    SELECT COALESCE(NULLIF(occupation, ''), 'Unspecified') AS label, COUNT(*) AS n
    FROM members GROUP BY label ORDER BY n DESC LIMIT 8
  `);

  const recent = await db.all(`
    SELECT id, application_number, full_name, mobile, district, status, created_at, photo_path
    FROM members ORDER BY created_at DESC LIMIT 8
  `);

  res.render('admin/dashboard', {
    active: 'dashboard',
    meta: { title: 'Admin Dashboard | RJP' },
    cards: { total, pending, approved, rejected, today },
    trends: {
      total: trend(regsThisWeek, regsPrevWeek),
      pending: trend(regsThisWeek, regsPrevWeek),
      approved: trend(approvedThisWeek, approvedPrevWeek),
      rejected: trend(rejectedThisWeek, rejectedPrevWeek),
      today: trend(today, yesterday)
    },
    statusBars: {
      approved: total ? Math.round((approved / total) * 100) : 0,
      pending: total ? Math.round(((pending + underReview) / total) * 100) : 0,
      rejected: total ? Math.round((rejected / total) * 100) : 0
    },
    recent,
    charts: {
      monthly: monthlyRows,
      district: districtRows,
      gender: genderRows,
      occupation: occupationRows
    }
  });
}));

async function logActivity(memberId, action, note, adminEmail) {
  await db.run(
    'INSERT INTO member_activity (member_id, action, note, admin_email) VALUES (?, ?, ?, ?)',
    [memberId, action, note || null, adminEmail || null]
  );
}

function mapBodyToMemberFields(body) {
  return {
    full_name: body.fullName || '',
    guardian_name: body.guardianName || '',
    dob: body.dob || '',
    gender: body.gender || '',
    mobile: body.mobile || '',
    whatsapp: body.whatsapp || '',
    email: body.email || '',
    aadhaar: body.aadhaar || '',
    address: body.address || '',
    state: body.state || '',
    district: body.district || '',
    taluk: body.taluk || '',
    assembly: body.assembly || '',
    parliament: body.parliament || '',
    ward: body.ward || '',
    booth: body.booth || '',
    occupation: body.occupation || '',
    education: body.education || '',
    religion: body.religion || '',
    caste: body.caste || '',
    sub_caste: body.subCaste || '',
    social_media: body.socialMedia || '',
    status: body.status || ''
  };
}

router.get('/admin/members', asyncHandler(async (req, res) => {
  const { q = '', district = '', status = '' } = req.query;
  let sql = 'SELECT * FROM members WHERE 1=1';
  const params = [];
  if (q) {
    const like = `%${q}%`;
    sql += ' AND (full_name LIKE ? OR mobile LIKE ? OR application_number LIKE ?)';
    params.push(like, like, like);
  }
  if (district) { sql += ' AND district = ?'; params.push(district); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';

  const members = await db.all(sql, params);

  res.render('admin/members', {
    active: 'members',
    meta: { title: 'Members | RJP Admin' },
    members,
    districts: KARNATAKA_DISTRICTS,
    statuses: ALL_STATUSES,
    filters: { q, district, status }
  });
}));

router.get('/admin/members/export.xlsx', asyncHandler(async (req, res) => {
  const members = await db.all(`
    SELECT application_number, full_name, mobile, gender, district, assembly, occupation, religion, status, created_at
    FROM members ORDER BY created_at DESC
  `);
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  await streamMembersExcel(res, members, logoPath);
}));

router.get('/admin/members/:id', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });
  const activity = await db.all('SELECT * FROM member_activity WHERE member_id = ? ORDER BY created_at DESC, id DESC', [member.id]);
  res.render('admin/member-detail', {
    active: 'members',
    meta: { title: `${member.full_name} | RJP Admin` },
    member,
    activity,
    interests: (member.areas_of_interest || '').split(',').map((s) => s.trim()).filter(Boolean)
  });
}));

router.get('/admin/members/:id/edit', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });
  res.render('admin/member-edit', {
    active: 'members',
    meta: { title: `Edit ${member.full_name} | RJP Admin` },
    member,
    districts: KARNATAKA_DISTRICTS,
    taluks: KARNATAKA_TALUKS,
    interests: AREAS_OF_INTEREST,
    selectedInterests: (member.areas_of_interest || '').split(',').map((s) => s.trim()).filter(Boolean),
    statuses: ALL_STATUSES,
    error: null
  });
}));

router.post('/admin/members/:id/edit', (req, res, next) => {
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'idUpload', maxCount: 1 }])(req, res, async (uploadErr) => {
    try {
      const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
      if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });

      const fail = (message) => {
        for (const f of [].concat(req.files?.photo || [], req.files?.idUpload || [])) {
          fs.unlink(f.path, () => {});
        }
        return res.status(400).render('admin/member-edit', {
          active: 'members',
          meta: { title: `Edit ${member.full_name} | RJP Admin` },
          member: { ...member, ...mapBodyToMemberFields(req.body) },
          districts: KARNATAKA_DISTRICTS,
          taluks: KARNATAKA_TALUKS,
          interests: AREAS_OF_INTEREST,
          selectedInterests: [].concat(req.body.areasOfInterest || []),
          statuses: ALL_STATUSES,
          error: message
        });
      };

      if (uploadErr) return fail(uploadErr.message);

      const { fullName, mobile, status } = req.body;
      if (!fullName || !fullName.trim()) return fail('Full name is required.');
      if (!/^[0-9]{10}$/.test(mobile || '')) return fail('Enter a valid 10-digit mobile number.');
      if (!ALL_STATUSES.includes(status)) return fail('Invalid status.');

      const dup = await db.get('SELECT id FROM members WHERE mobile = ? AND id != ?', [mobile, member.id]);
      if (dup) return fail('Another member already uses this mobile number.');

      const photoFile = req.files?.photo?.[0];
      const idFile = req.files?.idUpload?.[0];

      let photoPath = member.photo_path;
      if (photoFile) {
        if (member.photo_path) fs.unlink(path.join(PHOTO_DIR, member.photo_path), () => {});
        photoPath = path.basename(photoFile.path);
      }
      let idUploadPath = member.id_upload_path;
      if (idFile) {
        if (member.id_upload_path) fs.unlink(path.join(ID_DIR, member.id_upload_path), () => {});
        idUploadPath = path.basename(idFile.path);
      }

      const areasOfInterest = [].concat(req.body.areasOfInterest || []).join(', ');

      await db.run(
        `UPDATE members SET
          full_name=?, guardian_name=?, dob=?, gender=?, mobile=?,
          whatsapp=?, email=?, aadhaar=?, address=?,
          state=?, district=?, taluk=?, assembly=?, parliament=?, ward=?, booth=?,
          occupation=?, education=?, religion=?, caste=?, sub_caste=?,
          areas_of_interest=?, social_media=?, status=?,
          photo_path=?, id_upload_path=?
        WHERE id=?`,
        [
          fullName.trim(), req.body.guardianName || null, req.body.dob || null, req.body.gender || null, mobile,
          req.body.whatsapp || null, req.body.email || null, req.body.aadhaar || null, req.body.address || null,
          req.body.state || null, req.body.district || null, req.body.taluk || null, req.body.assembly || null, req.body.parliament || null, req.body.ward || null, req.body.booth || null,
          req.body.occupation || null, req.body.education || null, req.body.religion || null, req.body.caste || null, req.body.subCaste || null,
          areasOfInterest, req.body.socialMedia || null, status,
          photoPath, idUploadPath,
          member.id
        ]
      );

      if (status !== member.status) {
        await logActivity(member.id, 'Status Changed', `${member.status} → ${status}`, req.session.adminEmail);
      }
      await logActivity(member.id, 'Profile Updated', null, req.session.adminEmail);

      res.redirect(`/admin/members/${member.id}`);
    } catch (err) {
      next(err);
    }
  });
});

router.post('/admin/members/:id/approve', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).end();
  await db.run("UPDATE members SET status = 'Approved' WHERE id = ?", [member.id]);
  await logActivity(member.id, 'Approved', null, req.session.adminEmail);
  res.redirect(req.get('referer') || '/admin/members');
}));

router.post('/admin/members/:id/reject', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).end();
  await db.run("UPDATE members SET status = 'Rejected' WHERE id = ?", [member.id]);
  await logActivity(member.id, 'Rejected', req.body.reason || null, req.session.adminEmail);
  res.redirect(req.get('referer') || '/admin/members');
}));

router.post('/admin/members/:id/payment/verify', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).end();
  await db.run("UPDATE members SET payment_status = 'Verified' WHERE id = ?", [member.id]);
  await logActivity(member.id, 'Payment Verified', null, req.session.adminEmail);
  res.redirect(req.get('referer') || `/admin/members/${member.id}`);
}));

router.post('/admin/members/:id/payment/reject', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).end();
  await db.run("UPDATE members SET payment_status = 'Rejected' WHERE id = ?", [member.id]);
  await logActivity(member.id, 'Payment Rejected', req.body.reason || null, req.session.adminEmail);
  res.redirect(req.get('referer') || `/admin/members/${member.id}`);
}));

router.get('/admin/members/:id/payment-proof', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT payment_proof_path FROM members WHERE id = ?', [req.params.id]);
  if (!member || !member.payment_proof_path) return res.status(404).end();
  res.sendFile(path.join(PAYMENT_DIR, member.payment_proof_path));
}));

router.post('/admin/members/:id/delete', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).end();
  if (member.photo_path) fs.unlink(path.join(PHOTO_DIR, member.photo_path), () => {});
  if (member.id_upload_path) fs.unlink(path.join(ID_DIR, member.id_upload_path), () => {});
  if (member.payment_proof_path) fs.unlink(path.join(PAYMENT_DIR, member.payment_proof_path), () => {});
  await db.run('DELETE FROM members WHERE id = ?', [member.id]);
  res.redirect('/admin/members');
}));

router.get('/admin/members/:id/card', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });
  const qrDataUrl = await cardQrDataUrl(req, member.application_number);
  res.render('admin/member-card', {
    active: 'members',
    meta: { title: `Membership Card - ${member.full_name} | RJP Admin` },
    member,
    qrDataUrl
  });
}));

router.get('/admin/members/:id/card/pdf', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT * FROM members WHERE id = ?', [req.params.id]);
  if (!member) return res.status(404).end();
  const qrBuffer = await cardQrBuffer(req, member.application_number);
  await streamCardPdf(res, member, qrBuffer);
}));

router.get('/admin/members/:id/photo', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT photo_path FROM members WHERE id = ?', [req.params.id]);
  if (!member || !member.photo_path) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, member.photo_path));
}));

router.get('/admin/members/:id/id-upload', asyncHandler(async (req, res) => {
  const member = await db.get('SELECT id_upload_path FROM members WHERE id = ?', [req.params.id]);
  if (!member || !member.id_upload_path) return res.status(404).end();
  res.sendFile(path.join(ID_DIR, member.id_upload_path));
}));

const REPORT_TYPES = {
  district: { title: 'District Wise', chartType: 'bar-h', column: "COALESCE(NULLIF(district,''),'Unspecified')" },
  assembly: { title: 'Assembly Wise', chartType: 'bar-h', column: "COALESCE(NULLIF(assembly,''),'Unspecified')" },
  occupation: { title: 'Occupation Wise', chartType: 'doughnut', column: "COALESCE(NULLIF(occupation,''),'Unspecified')" },
  religion: { title: 'Religion Wise', chartType: 'pie', column: "COALESCE(NULLIF(religion,''),'Unspecified')" },
  gender: { title: 'Gender Wise', chartType: 'doughnut', column: "COALESCE(NULLIF(gender,''),'Not Specified')" },
  age: { title: 'Age Wise', chartType: 'bar-v' }
};
const REPORT_KEYS = Object.keys(REPORT_TYPES);

const AGE_GROUPS = [
  { key: 'below-18', label: 'Below 18', sql: "dob IS NOT NULL AND dob > DATE_SUB(CURDATE(), INTERVAL 18 YEAR)" },
  { key: '18-25', label: '18-25', sql: "dob IS NOT NULL AND dob <= DATE_SUB(CURDATE(), INTERVAL 18 YEAR) AND dob > DATE_SUB(CURDATE(), INTERVAL 26 YEAR)" },
  { key: '26-35', label: '26-35', sql: "dob IS NOT NULL AND dob <= DATE_SUB(CURDATE(), INTERVAL 26 YEAR) AND dob > DATE_SUB(CURDATE(), INTERVAL 36 YEAR)" },
  { key: '36-45', label: '36-45', sql: "dob IS NOT NULL AND dob <= DATE_SUB(CURDATE(), INTERVAL 36 YEAR) AND dob > DATE_SUB(CURDATE(), INTERVAL 46 YEAR)" },
  { key: '46-60', label: '46-60', sql: "dob IS NOT NULL AND dob <= DATE_SUB(CURDATE(), INTERVAL 46 YEAR) AND dob > DATE_SUB(CURDATE(), INTERVAL 61 YEAR)" },
  { key: 'above-60', label: 'Above 60', sql: "dob IS NOT NULL AND dob <= DATE_SUB(CURDATE(), INTERVAL 61 YEAR)" }
];
const AGE_GROUP_MAP = Object.fromEntries(AGE_GROUPS.map((g) => [g.key, g]));

function buildReportFilters(q) {
  const clauses = [];
  const params = [];
  const applied = [];

  if (q.dateFrom) { clauses.push('DATE(created_at) >= ?'); params.push(q.dateFrom); applied.push(`From ${q.dateFrom}`); }
  if (q.dateTo) { clauses.push('DATE(created_at) <= ?'); params.push(q.dateTo); applied.push(`To ${q.dateTo}`); }
  if (q.district) { clauses.push('district = ?'); params.push(q.district); applied.push(`District: ${q.district}`); }
  if (q.assembly) { clauses.push('assembly = ?'); params.push(q.assembly); applied.push(`Assembly: ${q.assembly}`); }
  if (q.gender) {
    if (q.gender === 'Not Specified') clauses.push("(gender IS NULL OR gender = '')");
    else { clauses.push('gender = ?'); params.push(q.gender); }
    applied.push(`Gender: ${q.gender}`);
  }
  if (q.occupation) { clauses.push('occupation = ?'); params.push(q.occupation); applied.push(`Occupation: ${q.occupation}`); }
  if (q.religion) { clauses.push('religion = ?'); params.push(q.religion); applied.push(`Religion: ${q.religion}`); }
  if (q.status) { clauses.push('status = ?'); params.push(q.status); applied.push(`Status: ${q.status}`); }
  if (q.ageGroup && AGE_GROUP_MAP[q.ageGroup]) {
    clauses.push(AGE_GROUP_MAP[q.ageGroup].sql);
    applied.push(`Age: ${AGE_GROUP_MAP[q.ageGroup].label}`);
  }

  return { whereSql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params, applied };
}

async function computeAgeBuckets(whereSql, params) {
  const dobs = await db.all(`SELECT dob FROM members WHERE 1=1 ${whereSql}`, params);
  const order = ['Below 18', '18-25', '26-35', '36-45', '46-60', 'Above 60'];
  const buckets = Object.fromEntries(order.map((l) => [l, 0]));
  const now = new Date();
  for (const { dob } of dobs) {
    const d = dob ? new Date(dob) : null;
    if (!d || Number.isNaN(d.getTime())) continue;
    let age = now.getFullYear() - d.getFullYear();
    const monthDiff = now.getMonth() - d.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < d.getDate())) age--;
    if (age < 18) buckets['Below 18']++;
    else if (age <= 25) buckets['18-25']++;
    else if (age <= 35) buckets['26-35']++;
    else if (age <= 45) buckets['36-45']++;
    else if (age <= 60) buckets['46-60']++;
    else buckets['Above 60']++;
  }
  return order.map((label) => ({ label, n: buckets[label] })).filter((r) => r.n > 0);
}

async function getReportRows(type, whereSql, params) {
  if (type === 'age') return computeAgeBuckets(whereSql, params);
  if (type === 'assembly') {
    return db.all(`
      SELECT COALESCE(NULLIF(assembly,''),'Unspecified') AS label,
             COALESCE(NULLIF(district,''),'Unspecified') AS district,
             COUNT(*) AS n
      FROM members WHERE 1=1 ${whereSql}
      GROUP BY label, district ORDER BY n DESC
    `, params);
  }
  const cfg = REPORT_TYPES[type];
  if (!cfg) return [];
  return db.all(`
    SELECT ${cfg.column} AS label, COUNT(*) AS n
    FROM members WHERE 1=1 ${whereSql}
    GROUP BY label ORDER BY n DESC
  `, params);
}

async function getFilterOptions() {
  const distinctCol = async (col) => {
    const rows = await db.all(`SELECT DISTINCT ${col} AS v FROM members WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`);
    return rows.map((r) => r.v);
  };
  const [assemblies, occupations, religions] = await Promise.all([
    distinctCol('assembly'), distinctCol('occupation'), distinctCol('religion')
  ]);
  return {
    districts: KARNATAKA_DISTRICTS,
    assemblies,
    genders: ['Male', 'Female', 'Other', 'Not Specified'],
    occupations,
    religions,
    statuses: ALL_STATUSES,
    ageGroups: AGE_GROUPS
  };
}

function reportQueryFromReq(req) {
  return {
    dateFrom: req.query.dateFrom || '',
    dateTo: req.query.dateTo || '',
    district: req.query.district || '',
    assembly: req.query.assembly || '',
    gender: req.query.gender || '',
    occupation: req.query.occupation || '',
    religion: req.query.religion || '',
    status: req.query.status || '',
    ageGroup: req.query.ageGroup || ''
  };
}

router.get('/admin/reports', asyncHandler(async (req, res) => {
  const type = REPORT_KEYS.includes(req.query.type) ? req.query.type : 'district';
  const filterQuery = reportQueryFromReq(req);
  const { whereSql, params, applied } = buildReportFilters(filterQuery);
  const rows = await getReportRows(type, whereSql, params);
  const total = rows.reduce((s, r) => s + r.n, 0);

  res.render('admin/reports', {
    active: 'reports',
    meta: { title: 'Reports | RJP Admin' },
    reportTypes: REPORT_TYPES,
    reportKeys: REPORT_KEYS,
    type,
    title: REPORT_TYPES[type].title,
    rows,
    total,
    filterOptions: await getFilterOptions(),
    filterQuery,
    appliedFilters: applied
  });
}));

router.get('/admin/reports/export.xlsx', asyncHandler(async (req, res) => {
  const type = REPORT_KEYS.includes(req.query.type) ? req.query.type : 'district';
  const filterQuery = reportQueryFromReq(req);
  const { whereSql, params, applied } = buildReportFilters(filterQuery);
  const rows = await getReportRows(type, whereSql, params);
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  await streamReportExcel(res, { title: REPORT_TYPES[type].title, rows, filters: applied, logoPath });
}));

router.get('/admin/reports/export.pdf', asyncHandler(async (req, res) => {
  const type = REPORT_KEYS.includes(req.query.type) ? req.query.type : 'district';
  const filterQuery = reportQueryFromReq(req);
  const { whereSql, params, applied } = buildReportFilters(filterQuery);
  const rows = await getReportRows(type, whereSql, params);
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  streamReportPdf(res, { title: REPORT_TYPES[type].title, chartType: REPORT_TYPES[type].chartType, rows, filters: applied, logoPath });
}));

router.get('/admin/cms', asyncHandler(async (req, res) => {
  const section = CMS_KEYS.includes(req.query.section) ? req.query.section : 'banner';
  const data = await getCmsSection(section);

  res.render('admin/cms', {
    active: 'cms',
    meta: { title: 'CMS | RJP Admin' },
    sections: CMS_SECTIONS,
    sectionKeys: CMS_KEYS,
    section,
    fields: CMS_SECTIONS[section].fields,
    data,
    saved: req.query.saved === '1'
  });
}));

router.post('/admin/cms/:section', asyncHandler(async (req, res) => {
  const { section } = req.params;
  if (!CMS_KEYS.includes(section)) return res.status(404).end();

  const data = {};
  CMS_SECTIONS[section].fields.forEach((f) => {
    if (f.type === 'lines') {
      data[f.name] = String(req.body[f.name] || '').split('\n').map((s) => s.trim()).filter(Boolean);
    } else {
      data[f.name] = req.body[f.name] || '';
    }
  });

  await saveCmsSection(section, data);
  res.redirect(`/admin/cms?section=${section}&saved=1`);
}));

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '..', 'assets', 'images'),
    filename: (req, file, cb) => cb(null, 'logo.jpg')
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg'].includes(ext)) return cb(new Error('Logo must be a JPG image.'));
    cb(null, true);
  },
  limits: { fileSize: 2 * 1024 * 1024 }
});

router.get('/admin/settings', asyncHandler(async (req, res) => {
  res.render('admin/settings', {
    active: 'settings',
    meta: { title: 'Settings | RJP Admin' },
    settings: await getAllSettings(),
    saved: req.query.saved === '1',
    logoSaved: req.query.logo === '1',
    error: req.query.error || null,
    passwordSaved: req.query.passwordSaved === '1',
    passwordError: req.query.passwordError || null
  });
}));

router.post('/admin/settings', asyncHandler(async (req, res) => {
  const updates = {};
  Object.keys(SETTINGS_DEFAULTS).forEach((k) => { updates[k] = String(req.body[k] || '').trim(); });

  if (!/^[A-Za-z0-9]{2,6}$/.test(updates.membership_prefix)) {
    return res.status(400).render('admin/settings', {
      active: 'settings',
      meta: { title: 'Settings | RJP Admin' },
      settings: { ...(await getAllSettings()), ...updates },
      saved: false,
      logoSaved: false,
      error: 'Membership prefix must be 2-6 letters/numbers.',
      passwordSaved: false,
      passwordError: null
    });
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(updates.primary_color)) updates.primary_color = SETTINGS_DEFAULTS.primary_color;
  if (!/^#[0-9A-Fa-f]{6}$/.test(updates.qr_color)) updates.qr_color = SETTINGS_DEFAULTS.qr_color;

  await setSettings(updates);
  res.redirect('/admin/settings?saved=1');
}));

router.post('/admin/settings/logo', (req, res) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return res.redirect(`/admin/settings?error=${encodeURIComponent(err.message)}`);
    res.redirect('/admin/settings?logo=1');
  });
});

router.post('/admin/settings/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const fail = (message) => res.redirect(`/admin/settings?passwordError=${encodeURIComponent(message)}`);

  const admin = await db.get('SELECT * FROM admins WHERE id = ?', [req.session.adminId]);
  if (!admin || !bcrypt.compareSync(currentPassword || '', admin.password_hash)) {
    return fail('Current password is incorrect.');
  }
  if (!newPassword || newPassword.length < 8) return fail('New password must be at least 8 characters.');
  if (newPassword !== confirmPassword) return fail('New passwords do not match.');

  await db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [bcrypt.hashSync(newPassword, 10), admin.id]);
  res.redirect('/admin/settings?passwordSaved=1');
}));

module.exports = router;
