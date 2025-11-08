const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 是否使用固定验证码（开发模式）
const USE_FIXED_OTP = process.env.USE_FIXED_OTP === 'true';

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
  let code;
  if (USE_FIXED_OTP) {
    code = '123456';
    console.log(`[MockSMS][${scene}] 固定验证码: ${code}`);
  } else {
    code = String(Math.floor(100000 + Math.random() * 900000));
    console.log(`[SMS][${scene}] 发送给 ${phone} 的验证码：${code}`);
  }

  captchaStore.set(k, { code, expireAt: now + CAPTCHA_TTL_MS, lastSendAt: now });
  return { expireAt: now + CAPTCHA_TTL_MS, hint: USE_FIXED_OTP ? 'fixed' : undefined };
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
  if (USE_FIXED_OTP) {
    if (code === '123456') return; // 固定码直接通过
  }

  if (!rec) {
    const e = new Error('请先获取验证码');
    e.status = 400; throw e;
  }
  // 通过后即刻删除，避免重放
  captchaStore.delete(k);
};

// ---------------- 带验证码的注册（客户/师傅都按实名 + 审核流） ----------------
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

  // ✅ 统一实名要求：客户 & 师傅都需要身份证姓名+号码
  if (!idCard?.name || !idCard?.number) {
    const e = new Error('请填写实名与身份证号');
    e.status = 400; throw e;
  }

  // 创建用户（注意：线上请改为密码哈希）
  const user = await User.create({
    username: phone, // 兼容历史：username=phone
    phone,
    password,
    role,
    profile,
    idCard,
    // ✅ 客户与师傅均进入审核流
    reviewStatus: (role === 'technician' || role === 'customer') ? 'pending' : undefined,
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

  if (['customer', 'technician'].includes(user.role)) {
    if (user.reviewStatus === 'pending') {
      const e = new Error('账号待审核');
      e.code = 'ACCOUNT_PENDING';
      e.status = 403;
      throw e;
    }
    if (user.reviewStatus === 'rejected') {
      const e = new Error('账号审核被驳回');
      e.code = 'ACCOUNT_REJECTED';
      e.status = 403;
      e.reason = user.reviewAudit?.reason || '未填写原因';
      throw e;
    }
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

exports.getReviewStatus = async (userId) => {
  const user = await User.findById(userId).select('reviewStatus reviewAudit reviewHistory idCard');
  if (!user) {
    const e = new Error('用户不存在');
    e.status = 404;
    throw e;
  }
  return user;
};

exports.resubmitReview = async (userId, { idCard = {} }) => {
  const user = await User.findById(userId);
  if (!user) {
    const e = new Error('用户不存在');
    e.status = 404;
    throw e;
  }
  if (!idCard.name || !idCard.number) {
    const e = new Error('请填写实名与身份证号');
    e.status = 400;
    throw e;
  }

  user.idCard = idCard;
  user.reviewStatus = 'pending';
  user.reviewAudit = { result: 'resubmitted', reason: null, auditedAt: new Date() };
  user.reviewHistory = user.reviewHistory || [];
  user.reviewHistory.push({ time: new Date(), result: 'resubmitted' });
  await user.save();
  return { user: { id: user._id, reviewStatus: user.reviewStatus } };
};

exports.resubmitReviewByPhone = async (phone, { idCard = {} } = {}) => {
  const user = await User.findOne({ phone });
  if (!user) {
    const e = new Error('用户不存在');
    e.status = 404; throw e;
  }
  if (!idCard.name || !idCard.number) {
    const e = new Error('请填写实名与身份证号');
    e.status = 400; throw e;
  }
  // 仅客户/师傅允许走审核流
  if (!['customer', 'technician'].includes(user.role)) {
    const e = new Error('该账号无需审核');
    e.status = 400; throw e;
  }

  // 更新实名信息 & 重置为 pending
  user.idCard = idCard;
  user.reviewStatus = 'pending';
  // 保留上次驳回记录，追加 resubmitted 轨迹
  user.reviewHistory = user.reviewHistory || [];
  user.reviewHistory.push({ time: new Date(), result: 'resubmitted' });
  // 可选择清理 reviewAudit，也可保留 last audit；这里保留，便于管理员回看
  await user.save();

  return { user: { id: user._id, reviewStatus: user.reviewStatus } };
};