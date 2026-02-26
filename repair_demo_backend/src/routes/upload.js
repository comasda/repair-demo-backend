// routes/upload.js
const express = require('express');
const router = express.Router();

const { uploader } = require('../middleware/upload');
const ctrl = require('../controllers/uploadController');
const { verifyJWT } = require('../middleware/auth');

// 云存储fileID注册接口（前端上传到云存储后，通知后端记录）
router.post('/cloud', verifyJWT, (req, res) => {
  const { fileID, type, metadata } = req.body;

  if (!fileID || !fileID.startsWith('cloud://')) {
    return res.status(400).json({ message: '无效的云存储fileID' });
  }

  // 这里可以记录文件信息到数据库，用于审计和管理
  // 暂时直接返回fileID
  res.json({
    url: fileID,
    fileID: fileID,
    type: type || 'image',
    metadata: metadata || {}
  });
});

// 支持两种上传方式：
// 1. 传统文件上传（multipart/form-data）
// 2. 云存储fileID传递（application/json）
router.post('/', verifyJWT, (req, res, next) => {
  // 如果是云存储fileID，直接处理
  if (req.body && req.body.fileID && req.body.fileID.startsWith('cloud://')) {
    return ctrl.single(req, res, next);
  }

  // 否则使用传统文件上传中间件
  uploader.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || '文件上传失败' });
    }
    ctrl.single(req, res, next);
  });
});

module.exports = router;
