// services/uploadService.js
/**
 * 说明：
 * - 这里不做文件写入（multer 已经落盘），只负责把 req.file 解析成业务可用结果。
 * - 如果未来改为 OSS/S3，只需在这里把本地文件转存到云，并返回云 URL。
 */

exports.buildPublicUrl = (req, filename) => {
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('host');
  const base = process.env.BASE_URL || `${proto}://${host}`;
  return `${base}/api/uploads/${filename}`;
};

exports.afterSingleUploaded = async (req) => {
  if (!req.file) {
    return { ok: false, message: '未收到文件' };
  }
  // 这里可以做：写库/审计/异步压缩等
  const url = exports.buildPublicUrl(req, req.file.filename);
  return { ok: true, url, filename: req.file.filename, size: req.file.size, mime: req.file.mimetype };
};
