const User = require('../models/User');

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
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ message: '用户名或密码错误' });
    }
    res.json({ message: '登录成功', user: { id: user._id, username: user.username, role: user.role } });
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
