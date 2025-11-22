// middlewares/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
    cb(null, name);
  }
});

const fileFilter = (_req, file, cb) => {
  // 允许的图片 / 视频类型
  const allow = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',      // mov
    'video/x-msvideo',      // avi
    'video/x-matroska',     // mkv
  ];

  if (!allow.includes(file.mimetype)) {
    return cb(new Error('仅支持 jpg/png/webp 及常见视频格式'));
  }

  cb(null, true);
};

exports.uploader = multer({
  storage,
  fileFilter,
  // 单文件大小限制：这里放大到 50MB，避免短视频被拒绝
  limits: { fileSize: 100 * 1024 * 1024 }
});
