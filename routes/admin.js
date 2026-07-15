const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { upload, PHOTO_DIR, ID_DIR } = require('../lib/upload');
const { SETTINGS_DEFAULTS, getAllSettings, setSettings } = require('../lib/settings');
const { KARNATAKA_DISTRICTS, AREAS_OF_INTEREST, ALL_STATUSES } = require('../lib/constants');
const { cardQrDataUrl, cardQrBuffer } = require('../lib/qr');
const { streamCardPdf } = require('../lib/cardPdf');
const { streamReportPdf } = require('../lib/reportPdf');
const { streamReportExcel, streamMembersExcel } = require('../lib/reportExcel');
const { CMS_SECTIONS, CMS_KEYS, getCmsSection, saveCmsSection } = require('../lib/cms');

const router = express.Router();

function requireAdminAuth(req, res, next) {
  if (!req.session.adminId) return res.redirect('/admin/login');
  next();
}

router.get('/admin/login', (req, res) => {
  if (req.session.adminId) return res.redirect('/admin');
  res.render('admin/login', { meta: { title: 'Admin Login | RJP' }, error: null });
});

router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get((email || '').trim().toLowerCase());

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
});

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

router.get('/admin/dashboard', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
  const pending = db.prepare("SELECT COUNT(*) AS n FROM members WHERE status = 'Pending Approval'").get().n;
  const approved = db.prepare("SELECT COUNT(*) AS n FROM members WHERE status IN ('Approved', 'Active')").get().n;
  const rejected = db.prepare("SELECT COUNT(*) AS n FROM members WHERE status = 'Rejected'").get().n;
  const today = db.prepare("SELECT COUNT(*) AS n FROM members WHERE date(created_at) = date('now')").get().n;
  const underReview = db.prepare("SELECT COUNT(*) AS n FROM members WHERE status = 'Under Review'").get().n;

  const regsThisWeek = db.prepare("SELECT COUNT(*) AS n FROM members WHERE created_at >= datetime('now','-7 days')").get().n;
  const regsPrevWeek = db.prepare("SELECT COUNT(*) AS n FROM members WHERE created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days')").get().n;
  const approvedThisWeek = db.prepare("SELECT COUNT(*) AS n FROM member_activity WHERE action='Approved' AND created_at >= datetime('now','-7 days')").get().n;
  const approvedPrevWeek = db.prepare("SELECT COUNT(*) AS n FROM member_activity WHERE action='Approved' AND created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days')").get().n;
  const rejectedThisWeek = db.prepare("SELECT COUNT(*) AS n FROM member_activity WHERE action='Rejected' AND created_at >= datetime('now','-7 days')").get().n;
  const rejectedPrevWeek = db.prepare("SELECT COUNT(*) AS n FROM member_activity WHERE action='Rejected' AND created_at >= datetime('now','-14 days') AND created_at < datetime('now','-7 days')").get().n;
  const yesterday = db.prepare("SELECT COUNT(*) AS n FROM members WHERE date(created_at) = date('now','-1 day')").get().n;

  const monthlyRows = db.prepare(`
    SELECT strftime('%Y-%m', created_at) AS ym, COUNT(*) AS n
    FROM members GROUP BY ym ORDER BY ym DESC LIMIT 6
  `).all().reverse();

  const districtRows = db.prepare(`
    SELECT COALESCE(NULLIF(district, ''), 'Unspecified') AS label, COUNT(*) AS n
    FROM members GROUP BY label ORDER BY n DESC LIMIT 8
  `).all();

  const genderRows = db.prepare(`
    SELECT COALESCE(NULLIF(gender, ''), 'Not Specified') AS label, COUNT(*) AS n
    FROM members GROUP BY label ORDER BY n DESC
  `).all();

  const occupationRows = db.prepare(`
    SELECT COALESCE(NULLIF(occupation, ''), 'Unspecified') AS label, COUNT(*) AS n
    FROM members GROUP BY label ORDER BY n DESC LIMIT 8
  `).all();

  const recent = db.prepare(`
    SELECT id, application_number, full_name, mobile, district, status, created_at, photo_path
    FROM members ORDER BY created_at DESC LIMIT 8
  `).all();

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
});

function logActivity(memberId, action, note, adminEmail) {
  db.prepare('INSERT INTO member_activity (member_id, action, note, admin_email) VALUES (?, ?, ?, ?)')
    .run(memberId, action, note || null, adminEmail || null);
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

router.get('/admin/members', (req, res) => {
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

  const members = db.prepare(sql).all(...params);

  res.render('admin/members', {
    active: 'members',
    meta: { title: 'Members | RJP Admin' },
    members,
    districts: KARNATAKA_DISTRICTS,
    statuses: ALL_STATUSES,
    filters: { q, district, status }
  });
});

router.get('/admin/members/export.xlsx', async (req, res) => {
  const members = db.prepare(`
    SELECT application_number, full_name, mobile, gender, district, assembly, occupation, religion, status, created_at
    FROM members ORDER BY created_at DESC
  `).all();
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  await streamMembersExcel(res, members, logoPath);
});

router.get('/admin/members/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });
  const activity = db.prepare('SELECT * FROM member_activity WHERE member_id = ? ORDER BY created_at DESC, id DESC').all(member.id);
  res.render('admin/member-detail', {
    active: 'members',
    meta: { title: `${member.full_name} | RJP Admin` },
    member,
    activity,
    interests: (member.areas_of_interest || '').split(',').map((s) => s.trim()).filter(Boolean)
  });
});

router.get('/admin/members/:id/edit', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });
  res.render('admin/member-edit', {
    active: 'members',
    meta: { title: `Edit ${member.full_name} | RJP Admin` },
    member,
    districts: KARNATAKA_DISTRICTS,
    interests: AREAS_OF_INTEREST,
    selectedInterests: (member.areas_of_interest || '').split(',').map((s) => s.trim()).filter(Boolean),
    statuses: ALL_STATUSES,
    error: null
  });
});

router.post('/admin/members/:id/edit', (req, res) => {
  upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'idUpload', maxCount: 1 }])(req, res, (uploadErr) => {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
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

    const dup = db.prepare('SELECT id FROM members WHERE mobile = ? AND id != ?').get(mobile, member.id);
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

    db.prepare(`
      UPDATE members SET
        full_name=@full_name, guardian_name=@guardian_name, dob=@dob, gender=@gender, mobile=@mobile,
        whatsapp=@whatsapp, email=@email, aadhaar=@aadhaar, address=@address,
        state=@state, district=@district, taluk=@taluk, assembly=@assembly, parliament=@parliament, ward=@ward, booth=@booth,
        occupation=@occupation, education=@education, religion=@religion, caste=@caste, sub_caste=@sub_caste,
        areas_of_interest=@areas_of_interest, social_media=@social_media, status=@status,
        photo_path=@photo_path, id_upload_path=@id_upload_path
      WHERE id=@id
    `).run({
      id: member.id,
      full_name: fullName.trim(),
      guardian_name: req.body.guardianName || null,
      dob: req.body.dob || null,
      gender: req.body.gender || null,
      mobile,
      whatsapp: req.body.whatsapp || null,
      email: req.body.email || null,
      aadhaar: req.body.aadhaar || null,
      address: req.body.address || null,
      state: req.body.state || null,
      district: req.body.district || null,
      taluk: req.body.taluk || null,
      assembly: req.body.assembly || null,
      parliament: req.body.parliament || null,
      ward: req.body.ward || null,
      booth: req.body.booth || null,
      occupation: req.body.occupation || null,
      education: req.body.education || null,
      religion: req.body.religion || null,
      caste: req.body.caste || null,
      sub_caste: req.body.subCaste || null,
      areas_of_interest: areasOfInterest,
      social_media: req.body.socialMedia || null,
      status,
      photo_path: photoPath,
      id_upload_path: idUploadPath
    });

    if (status !== member.status) {
      logActivity(member.id, 'Status Changed', `${member.status} → ${status}`, req.session.adminEmail);
    }
    logActivity(member.id, 'Profile Updated', null, req.session.adminEmail);

    res.redirect(`/admin/members/${member.id}`);
  });
});

router.post('/admin/members/:id/approve', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).end();
  db.prepare("UPDATE members SET status = 'Approved' WHERE id = ?").run(member.id);
  logActivity(member.id, 'Approved', null, req.session.adminEmail);
  res.redirect(req.get('referer') || '/admin/members');
});

router.post('/admin/members/:id/reject', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).end();
  db.prepare("UPDATE members SET status = 'Rejected' WHERE id = ?").run(member.id);
  logActivity(member.id, 'Rejected', req.body.reason || null, req.session.adminEmail);
  res.redirect(req.get('referer') || '/admin/members');
});

router.post('/admin/members/:id/delete', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).end();
  if (member.photo_path) fs.unlink(path.join(PHOTO_DIR, member.photo_path), () => {});
  if (member.id_upload_path) fs.unlink(path.join(ID_DIR, member.id_upload_path), () => {});
  db.prepare('DELETE FROM members WHERE id = ?').run(member.id);
  res.redirect('/admin/members');
});

router.get('/admin/members/:id/card', async (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).render('404', { page: '', meta: { title: 'Not Found | RJP Admin' } });
  const qrDataUrl = await cardQrDataUrl(req, member.application_number);
  res.render('admin/member-card', {
    active: 'members',
    meta: { title: `Membership Card - ${member.full_name} | RJP Admin` },
    member,
    qrDataUrl
  });
});

router.get('/admin/members/:id/card/pdf', async (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) return res.status(404).end();
  const qrBuffer = await cardQrBuffer(req, member.application_number);
  streamCardPdf(res, member, qrBuffer);
});

router.get('/admin/members/:id/photo', (req, res) => {
  const member = db.prepare('SELECT photo_path FROM members WHERE id = ?').get(req.params.id);
  if (!member || !member.photo_path) return res.status(404).end();
  res.sendFile(path.join(PHOTO_DIR, member.photo_path));
});

router.get('/admin/members/:id/id-upload', (req, res) => {
  const member = db.prepare('SELECT id_upload_path FROM members WHERE id = ?').get(req.params.id);
  if (!member || !member.id_upload_path) return res.status(404).end();
  res.sendFile(path.join(ID_DIR, member.id_upload_path));
});

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
  { key: 'below-18', label: 'Below 18', sql: "dob IS NOT NULL AND dob > date('now','-18 years')" },
  { key: '18-25', label: '18-25', sql: "dob IS NOT NULL AND dob <= date('now','-18 years') AND dob > date('now','-26 years')" },
  { key: '26-35', label: '26-35', sql: "dob IS NOT NULL AND dob <= date('now','-26 years') AND dob > date('now','-36 years')" },
  { key: '36-45', label: '36-45', sql: "dob IS NOT NULL AND dob <= date('now','-36 years') AND dob > date('now','-46 years')" },
  { key: '46-60', label: '46-60', sql: "dob IS NOT NULL AND dob <= date('now','-46 years') AND dob > date('now','-61 years')" },
  { key: 'above-60', label: 'Above 60', sql: "dob IS NOT NULL AND dob <= date('now','-61 years')" }
];
const AGE_GROUP_MAP = Object.fromEntries(AGE_GROUPS.map((g) => [g.key, g]));

function buildReportFilters(q) {
  const clauses = [];
  const params = [];
  const applied = [];

  if (q.dateFrom) { clauses.push('date(created_at) >= ?'); params.push(q.dateFrom); applied.push(`From ${q.dateFrom}`); }
  if (q.dateTo) { clauses.push('date(created_at) <= ?'); params.push(q.dateTo); applied.push(`To ${q.dateTo}`); }
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

function computeAgeBuckets(whereSql, params) {
  const dobs = db.prepare(`SELECT dob FROM members WHERE 1=1 ${whereSql}`).all(...params);
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

function getReportRows(type, whereSql, params) {
  if (type === 'age') return computeAgeBuckets(whereSql, params);
  if (type === 'assembly') {
    return db.prepare(`
      SELECT COALESCE(NULLIF(assembly,''),'Unspecified') AS label,
             COALESCE(NULLIF(district,''),'Unspecified') AS district,
             COUNT(*) AS n
      FROM members WHERE 1=1 ${whereSql}
      GROUP BY label, district ORDER BY n DESC
    `).all(...params);
  }
  const cfg = REPORT_TYPES[type];
  if (!cfg) return [];
  return db.prepare(`
    SELECT ${cfg.column} AS label, COUNT(*) AS n
    FROM members WHERE 1=1 ${whereSql}
    GROUP BY label ORDER BY n DESC
  `).all(...params);
}

function getFilterOptions() {
  const distinctCol = (col) => db.prepare(`SELECT DISTINCT ${col} AS v FROM members WHERE ${col} IS NOT NULL AND ${col} != '' ORDER BY ${col}`).all().map((r) => r.v);
  return {
    districts: KARNATAKA_DISTRICTS,
    assemblies: distinctCol('assembly'),
    genders: ['Male', 'Female', 'Other', 'Not Specified'],
    occupations: distinctCol('occupation'),
    religions: distinctCol('religion'),
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

router.get('/admin/reports', (req, res) => {
  const type = REPORT_KEYS.includes(req.query.type) ? req.query.type : 'district';
  const filterQuery = reportQueryFromReq(req);
  const { whereSql, params, applied } = buildReportFilters(filterQuery);
  const rows = getReportRows(type, whereSql, params);
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
    filterOptions: getFilterOptions(),
    filterQuery,
    appliedFilters: applied
  });
});

router.get('/admin/reports/export.xlsx', async (req, res) => {
  const type = REPORT_KEYS.includes(req.query.type) ? req.query.type : 'district';
  const filterQuery = reportQueryFromReq(req);
  const { whereSql, params, applied } = buildReportFilters(filterQuery);
  const rows = getReportRows(type, whereSql, params);
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  await streamReportExcel(res, { title: REPORT_TYPES[type].title, rows, filters: applied, logoPath });
});

router.get('/admin/reports/export.pdf', (req, res) => {
  const type = REPORT_KEYS.includes(req.query.type) ? req.query.type : 'district';
  const filterQuery = reportQueryFromReq(req);
  const { whereSql, params, applied } = buildReportFilters(filterQuery);
  const rows = getReportRows(type, whereSql, params);
  const logoPath = path.join(__dirname, '..', 'assets', 'images', 'logo.jpg');
  streamReportPdf(res, { title: REPORT_TYPES[type].title, chartType: REPORT_TYPES[type].chartType, rows, filters: applied, logoPath });
});

router.get('/admin/cms', (req, res) => {
  const section = CMS_KEYS.includes(req.query.section) ? req.query.section : 'banner';
  const data = getCmsSection(section);

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
});

router.post('/admin/cms/:section', (req, res) => {
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

  saveCmsSection(section, data);
  res.redirect(`/admin/cms?section=${section}&saved=1`);
});

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

router.get('/admin/settings', (req, res) => {
  res.render('admin/settings', {
    active: 'settings',
    meta: { title: 'Settings | RJP Admin' },
    settings: getAllSettings(),
    saved: req.query.saved === '1',
    logoSaved: req.query.logo === '1',
    error: req.query.error || null
  });
});

router.post('/admin/settings', (req, res) => {
  const updates = {};
  Object.keys(SETTINGS_DEFAULTS).forEach((k) => { updates[k] = String(req.body[k] || '').trim(); });

  if (!/^[A-Za-z0-9]{2,6}$/.test(updates.membership_prefix)) {
    return res.status(400).render('admin/settings', {
      active: 'settings',
      meta: { title: 'Settings | RJP Admin' },
      settings: { ...getAllSettings(), ...updates },
      saved: false,
      logoSaved: false,
      error: 'Membership prefix must be 2-6 letters/numbers.'
    });
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(updates.primary_color)) updates.primary_color = SETTINGS_DEFAULTS.primary_color;
  if (!/^#[0-9A-Fa-f]{6}$/.test(updates.qr_color)) updates.qr_color = SETTINGS_DEFAULTS.qr_color;

  setSettings(updates);
  res.redirect('/admin/settings?saved=1');
});

router.post('/admin/settings/logo', (req, res) => {
  logoUpload.single('logo')(req, res, (err) => {
    if (err) return res.redirect(`/admin/settings?error=${encodeURIComponent(err.message)}`);
    res.redirect('/admin/settings?logo=1');
  });
});

module.exports = router;
