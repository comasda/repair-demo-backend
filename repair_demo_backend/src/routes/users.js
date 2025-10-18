const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { verifyJWT } = require('../middleware/auth');

// 短信验证码（Mock/可换短信平台）
router.post('/captcha/send', ctrl.sendCaptcha);     // { phone, scene }
router.post('/captcha/verify', ctrl.verifyCaptcha); // 可选：通用校验接口
router.post('/register', ctrl.register);

router.post('/login', ctrl.login);
router.post('/admin/login', ctrl.adminLogin); // 管理员登录
router.get('/me', verifyJWT, ctrl.me);        // 当前登录用户
router.get('/:id', verifyJWT, ctrl.getUser);  // 保护：需登录

module.exports = router;
