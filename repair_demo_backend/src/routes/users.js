const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');
const { verifyJWT } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/admin/login', ctrl.adminLogin); // 管理员登录
router.get('/me', verifyJWT, ctrl.me);        // 当前登录用户
router.get('/:id', verifyJWT, ctrl.getUser);  // 保护：需登录

module.exports = router;
