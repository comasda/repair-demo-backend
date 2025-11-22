// controllers/uploadController.js
const uploadService = require('../services/uploadService');

exports.single = async (req, res, next) => {
  console.log('Received files:', req.files);
  try {
    const r = await uploadService.afterSingleUploaded(req);
    if (!r.ok) return res.status(400).json({ message: r.message || '上传失败' });
    // 前端期望 { url }
    return res.json({ url: r.url });
  } catch (e) {
    next(e);
  }
};
