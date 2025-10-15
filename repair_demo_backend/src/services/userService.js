const User = require('../models/User');
const jwt = require('jsonwebtoken');

const sign = (u) =>
  jwt.sign(
    { sub: String(u._id), role: u.role, username: u.username },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
  );

exports.register = async ({ username, password, role }) => {
  if (!username || !password) {
    const e = new Error('用户名和密码不能为空');
    e.status = 400;
    throw e;
  }
  const exists = await User.findOne({ username });
  if (exists) {
    const e = new Error('用户已存在');
    e.status = 400;
    throw e;
  }
  const user = await User.create({ username, password, role: role || 'customer' }); // TODO: bcrypt
  return {
    user: { id: user._id, username: user.username, role: user.role },
    accessToken: sign(user),
  };
};

exports.login = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user || user.password !== password) {
    const e = new Error('用户名或密码错误');
    e.status = 401;
    throw e;
  }
  return {
    user: { id: user._id, username: user.username, role: user.role },
    accessToken: sign(user),
  };
};

exports.adminLogin = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user || user.password !== password) {
    const e = new Error('用户名或密码错误');
    e.status = 401;
    throw e;
  }
  if (user.role !== 'admin') {
    const e = new Error('该账号不是管理员');
    e.status = 403;
    throw e;
  }
  return {
    user: { id: user._id, username: user.username, role: user.role },
    accessToken: sign(user),
  };
};

exports.getById = async (id) => {
  const doc = await User.findById(id).select('-password');
  if (!doc) {
    const e = new Error('用户不存在');
    e.status = 404;
    throw e;
  }
  return doc;
};