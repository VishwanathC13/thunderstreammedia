const express = require('express');
const { requireAuth, requireRole } = require('../../middleware/auth');
const { upload, getMediaUrl } = require('../../integrations/storage');

const router = express.Router();
router.use(requireAuth, requireRole('OWNER', 'EDITOR'));

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.status(201).json({ path: req.file.filename, url: getMediaUrl(req.file.filename) });
});

module.exports = router;
