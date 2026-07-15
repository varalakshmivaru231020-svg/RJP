const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');
const PHOTO_DIR = path.join(UPLOAD_ROOT, 'photos');
const ID_DIR = path.join(UPLOAD_ROOT, 'ids');
for (const dir of [PHOTO_DIR, ID_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, file.fieldname === 'idUpload' ? ID_DIR : PHOTO_DIR);
  },
  filename(req, file, cb) {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  }
});

const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED.has(ext)) return cb(new Error('Only JPG, PNG or PDF files are allowed.'));
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024, files: 2 }
});

module.exports = { upload, PHOTO_DIR, ID_DIR };
