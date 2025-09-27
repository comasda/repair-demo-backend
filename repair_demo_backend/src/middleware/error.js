function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err);
  res.status(500).json({ message: '服务器内部错误', detail: err.message || String(err) });
}
module.exports = { errorHandler };
