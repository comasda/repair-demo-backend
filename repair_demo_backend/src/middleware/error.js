function errorHandler(err, req, res, next) {
  // 统一规范化
  const status = Number(err.status) || (err.name === 'ValidationError' ? 400 : 500);
  const body = {
    ok: false,
    status,
    message: String(err.message || '服务器内部错误'),
  };
  // 透传业务错误码/原因（供前端识别）
  if (err.code) body.code = String(err.code);
  if (err.reason) body.reason = String(err.reason);

  // 记录日志
  console.error('[ERROR]', {
    status,
    code: body.code,
    message: body.message,
    reason: body.reason,
    stack: err.stack,
  });

  // 开发环境可返回少量细节（生产环境请去掉）
  if (process.env.NODE_ENV !== 'production') {
    body.detail = err.stack?.split('\n')[0];
  }
  res.status(status).json(body);
}
module.exports = { errorHandler };
