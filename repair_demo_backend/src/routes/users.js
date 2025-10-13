const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/:id', ctrl.getUser);
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// 管理员登录（签发 JWT）
router.post('/admin/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: '缺少用户名或密码' });
    }
    const user = await User.findOne({ username }).lean();
    if (!user || user.password !== password) {
      // 当前项目密码为明文 MVP；后续建议改为 bcrypt
      return res.status(401).json({ message: '用户名或密码不正确' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: '该账号不是管理员' });
    }
    const payload = { sub: String(user._id), role: user.role, username: user.username };
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
    );
    res.json({
      accessToken: token,
      user: { id: String(user._id), username: user.username, role: user.role }
    });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
