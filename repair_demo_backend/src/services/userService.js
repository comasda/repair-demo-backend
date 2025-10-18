const User = require('../models/User');
const jwt = require('jsonwebtoken');

const sign = (u) =>
  jwt.sign(
    { sub: String(u._id), role: u.role, username: u.username },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: process.env.TOKEN_EXPIRES_IN || '7d' }
  );


// ---------------- 验证码存储（开发/联调 mock，可替换 Redis） ----------------
const CAPTCHA_TTL_MS = Number(process.env.CAPTCHA_TTL_SECONDS || 300) * 1000; // 默认5分钟
const CAPTCHA_MIN_INTERVAL_MS = 60 * 1000; // 频控：60s
// Map key: `${scene}:${phone}` -> { code, expireAt, lastSendAt }
const captchaStore = new Map();

function key(phone, scene) { return `${scene}:${phone}`; }

exports.sendCaptcha = async (phone, scene = 'register') => {
  if (!phone) {
    const e = new Error('手机号不能为空');
    e.status = 400; throw e;
  }
  const k = key(phone, scene);
  const now = Date.now();
  const exist = captchaStore.get(k);
  if (exist && now - (exist.lastSendAt || 0) < CAPTCHA_MIN_INTERVAL_MS) {
    const e = new Error('验证码发送过于频繁，请稍后再试');
    e.status = 429; throw e;
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  captchaStore.set(k, { code, expireAt: now + CAPTCHA_TTL_MS, lastSendAt: now });
  // TODO: 在此接入真实短信平台（阿里云/腾讯云），此处仅打印
  console.log(`[SMS][${scene}] 发送给 ${phone} 的验证码：${code}`);
  return { expireAt: now + CAPTCHA_TTL_MS };
};

exports.verifyCaptcha = async (phone, code, scene = 'register') => {
  const k = key(phone, scene);
  const rec = captchaStore.get(k);
  if (!rec) {
    const e = new Error('请先获取验证码');
    e.status = 400; throw e;
  }
  const now = Date.now();
  if (now > rec.expireAt) {
    captchaStore.delete(k);
    const e = new Error('验证码已过期');
    e.status = 400; throw e;
  }
  if (rec.code !== code) {
    const e = new Error('验证码错误');
    e.status = 400; throw e;
  }
  // 通过后即刻删除，避免重放
  captchaStore.delete(k);
};

// ---------------- 带验证码的注册（支持客户/师傅差异校验） ----------------
exports.register = async ({ phone, password, code, role = 'customer', profile = {}, idCard = {} }) => {
  if (!phone || !password || !code) {
    const e = new Error('手机号、验证码和密码均不能为空');
    e.status = 400; throw e;
  }

  // 校验验证码（scene=register）
  await exports.verifyCaptcha(phone, code, 'register');

  // 查重：按 phone 唯一
  const exists = await User.findOne({ phone }).lean();
  if (exists) {
    const e = new Error('该手机号已注册');
    e.status = 400; throw e;
  }

  // 角色必填校验
  if (role === 'customer') {
    if (!profile?.name || !profile?.gender) {
      const e = new Error('客户注册需提供姓名与性别');
      e.status = 400; throw e;
    }
  } else if (role === 'technician') {
    if (!idCard?.name || !idCard?.number) {
      const e = new Error('师傅注册需提供身份证姓名和号码');
      e.status = 400; throw e;
    }
  }

  // 创建用户（注意：线上请改为密码哈希）
  const user = await User.create({
    username: phone, // 兼容历史：username=phone
    phone,
    password,
    role,
    profile,
    idCard,
    reviewStatus: role === 'technician' ? 'pending' : undefined,
  });

  return {
    user: { id: user._id, phone: user.phone, role: user.role },
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