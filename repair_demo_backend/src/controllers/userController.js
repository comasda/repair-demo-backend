const userService = require('../services/userService');

// 发送验证码
exports.sendCaptcha = async (req, res, next) => {
  try {
    const { phone, scene = 'register' } = req.body || {};
    const data = await userService.sendCaptcha(phone, scene);
    res.json({ ok: true, message: '验证码已发送', ...data });
  } catch (err) { next(err); }
};

// （可选）单独校验验证码：用于找回密码/改绑等
exports.verifyCaptcha = async (req, res, next) => {
  try {
    const { phone, code, scene = 'register' } = req.body || {};
    await userService.verifyCaptcha(phone, code, scene);
    res.json({ ok: true, message: '验证通过' });
  } catch (err) { next(err); }
};

exports.register = async (req, res, next) => {
  try {
    const data = await userService.register(req.body || {});
    res.json({ ok: true, message: '注册成功', ...data });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const data = await userService.login(username, password);
    res.json({ message: '登录成功', ...data });
  } catch (err) {
    next(err);
  }
};

// 管理员登录
exports.adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const data = await userService.adminLogin(username, password);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const doc = await userService.getById(req.params.id);
    res.json(doc);
  } catch (err) {
    next(err);
  }
};

// 当前登录用户信息（用于小程序拉取登录态）
exports.me = async (req, res) => {
  res.json({
    user: {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.role,
    },
  });
};
