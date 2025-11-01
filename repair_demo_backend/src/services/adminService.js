// services/adminService.js
const Order = require('../models/Order');
const User  = require('../models/User');

function httpError(status, message) {
  const e = new Error(message);
  e.statusCode = status;
  return e;
}
const now = () => new Date().toISOString();

exports.listForAdmin = async (status) => {
  const q = status ? { status } : {};
  return Order.find(q).sort({ createdAt: -1 }).lean();
};

// 管理员发起指派：pending/offered -> offered（并发安全）
exports.assignOrder = async (id, { technicianId, technicianName = '', adminId = '', adminName = '' } = {}) => {
  if (!technicianId) throw httpError(400, '缺少参数: technicianId');

  // 先校验存在性，便于明确 404
  const exist = await Order.findById(id);
  if (!exist) throw httpError(404, '订单不存在');

  const t = now();
  const updated = await Order.findOneAndUpdate(
    { _id: id, status: { $in: ['pending', 'offered'] } },  // 条件更新，抗并发
    {
      $set: {
        status: 'offered',
        technicianId,
        technicianName,
        'offerFlow.offeredAt': t,
        'offerFlow.offeredBy': adminName || adminId || 'admin',
      },
      $push: {
        history: { time: t, note: `管理员指派给 ${technicianName || technicianId}（待接收）` },
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    // 并发下可能被别人改状态了
    throw httpError(409, '指派失败：订单状态已变化，请刷新后重试');
  }
  return updated;
};

// 导出所有订单
exports.exportOrders = async (filter = {}) => {
  const Order = require('../models/Order');
  const q = {};

  if (filter.status) q.status = filter.status;
  if (filter.from || filter.to) {
    q.createdAt = {};
    if (filter.from) q.createdAt.$gte = new Date(filter.from);
    if (filter.to) q.createdAt.$lte = new Date(filter.to);
  }

  return Order.find(q).sort({ createdAt: -1 }).lean();
};

// ========= 技师审核相关 =========
exports.listTechnicians = async ({ status, q, page = 1, pageSize = 20 } = {}) => {
  const query = { role: 'technician' };
  if (status) query.reviewStatus = status;
  if (q) {
    // 可按用户名/手机号/实名模糊
    query.$or = [
      { username: new RegExp(q, 'i') },
      { phone:    new RegExp(q, 'i') },
      { 'idCard.name': new RegExp(q, 'i') }
    ];
  }
  page = Math.max(1, Number(page) || 1);
  pageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    User.find(query, {
      username: 1, phone: 1, role: 1,
      reviewStatus: 1, idCard: 1, createdAt: 1, reviewAudit: 1
    }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(query)
  ]);
  return { items, total, page, pageSize };
};

exports.getTechnician = async (id) => {
  const doc = await User.findOne({ _id: id, role: 'technician' }, {
    username: 1, phone: 1, role: 1, profile: 1, idCard: 1,
    reviewStatus: 1, reviewAudit: 1, reviewHistory: 1, createdAt: 1
  }).lean();
  if (!doc) throw httpError(404, '技师不存在');
  return doc;
};

exports.approveTechnician = async (id, { adminId, adminName } = {}) => {
  const t = new Date();
  const user = await User.findOne({ _id: id, role: 'technician' });
  if (!user) throw httpError(404, '技师不存在');
  if (user.reviewStatus === 'approved') return user;             // 幂等
  if (user.reviewStatus !== 'pending') throw httpError(409, '当前状态不可通过');

  user.reviewStatus = 'approved';
  user.reviewAudit = { auditedAt: t, auditedBy: adminName || adminId || 'admin', result: 'approved', reason: '' };
  user.reviewHistory = user.reviewHistory || [];
  user.reviewHistory.push({ time: t, admin: adminName || adminId || 'admin', result: 'approved', reason: '' });
  await user.save();
  return user.toObject();
};

exports.rejectTechnician = async (id, reason = '', { adminId, adminName } = {}) => {
  const t = new Date();
  const user = await User.findOne({ _id: id, role: 'technician' });
  if (!user) throw httpError(404, '技师不存在');
  if (user.reviewStatus === 'rejected' && user.reviewAudit?.reason === reason) return user; // 幂等
  if (user.reviewStatus !== 'pending') throw httpError(409, '当前状态不可驳回');

  user.reviewStatus = 'rejected';
  user.reviewAudit  = { auditedAt: t, auditedBy: adminName || adminId || 'admin', result: 'rejected', reason: reason || '' };
  user.reviewHistory = user.reviewHistory || [];
  user.reviewHistory.push({ time: t, admin: adminName || adminId || 'admin', result: 'rejected', reason: reason || '' });
  await user.save();
  return user.toObject();
};