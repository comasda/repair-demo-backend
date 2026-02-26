// controllers/uploadController.js
const uploadService = require('../services/uploadService');

exports.single = async (req, res, next) => {
  try {
    // 检查是否是云存储fileID（以cloud://开头）
    if (req.body && req.body.fileID && req.body.fileID.startsWith('cloud://')) {
      // 直接返回云存储fileID，无需处理文件
      return res.json({
        url: req.body.fileID,
        fileID: req.body.fileID
      });
    }

    // 传统文件上传处理（兼容旧版本）
    const r = await uploadService.afterSingleUploaded(req);
    if (!r.ok) return res.status(400).json({ message: r.message || '上传失败' });

    // 前端期望 { url }
    return res.json({ url: r.url });
  } catch (e) {
    next(e);
  }
};
