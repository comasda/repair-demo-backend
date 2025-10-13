const User = require('../models/User');
const jwt = require('jsonwebtoken');

exports.register = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: '用户名和密码不能为空' });
    }
    const exists = await User.findOne({ username });
    if (exists) {
      return res.status(400).json({ message: '用户已存在' });
    }
    const user = await User.create({ username, password, role: role || 'customer' });
    res.json({ message: '注册成功', user: { id: user._id, username: user.username, role: user.role } });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    // 先按用户名查，再比对密码（当前为明文 MVP；后续可替换为 bcrypt.compare）
    const user = await User.findOne({ username });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    // 签发 JWT（所有角色通用）
    const payload = { sub: String(user._id), role: user.role, username: user.username };
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
    );
    res.json({
      message: '登录成功',
      user: { id: user._id, username: user.username, role: user.role },
      accessToken: token
    });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');
    if (!user) return res.status(404).json({ message: '用户不存在' });
    res.json(user);
  } catch (err) {
    next(err);
  }
};
