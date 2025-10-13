const jwt = require('jsonwebtoken');

function verifyJWT(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: '未提供登录令牌' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload; // { sub, role, username, iat, exp }
    next();
  } catch (e) {
    return res.status(401).json({ message: '令牌无效或已过期' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: '无权访问' });
    }
    next();
  };
}

module.exports = { verifyJWT, requireRole };
