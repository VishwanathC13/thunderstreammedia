// Real (not mocked) local-disk media storage — stands in for S3/R2/Mux.
// Single swap point: reimplement saveUpload/getMediaUrl against a real
// object-storage SDK later without touching any route that calls this.
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB, generous for showreel-length mp4s
});

function getMediaUrl(filename) {
  if (!filename) return null;
  if (/^https?:\/\//i.test(filename)) return filename;
  return `/media/${filename}`;
}

module.exports = { upload, getMediaUrl, UPLOAD_DIR };
