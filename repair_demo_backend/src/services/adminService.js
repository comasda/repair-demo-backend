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

// ========= 管理员修改订单状态 =========
const ALLOWED_STATUSES = ['pending','offered','assigned','checkedIn','awaitingConfirm','done','cancelled'];
// 简易状态机限制：已完成/已取消不可回退；其他放宽（如有更严规则可再细化）
const FORBID_FROM = new Set(['done','cancelled']);

exports.updateOrderStatus = async (id, nextStatus, { reason = '', adminId = '', adminName = '' } = {}) => {
  if (!ALLOWED_STATUSES.includes(nextStatus)) {
    throw httpError(400, `非法状态: ${nextStatus}`);
  }

  const doc = await Order.findById(id);
  if (!doc) throw httpError(404, '订单不存在');

  const from = doc.status;
  if (FORBID_FROM.has(from) && nextStatus !== from) {
    throw httpError(409, `当前状态(${from})不可变更`);
  }
  if (from === nextStatus) {
    // 幂等：不改动直接返回
    return doc.toObject();
  }

  const t = now();
  const ops = {
    $set: { status: nextStatus },
    $push: { history: { time: t, note: `管理员将状态 ${from} → ${nextStatus}${reason ? `（${reason}）` : ''}` } }
  };

  // 若是取消，写 cancelFlow
  if (nextStatus === 'cancelled') {
    ops.$set['cancelFlow.cancelledAt'] = t;
    ops.$set['cancelFlow.cancelledBy'] = adminName || adminId || 'admin';
    if (reason) ops.$set['cancelFlow.reason'] = reason;
  }

  const updated = await Order.findOneAndUpdate(
    { _id: id }, ops, { new: true }
  ).lean();
  return updated;
};

// 获取单个订单（管理端）
exports.getOrderById = async (id) => {
  const o = await Order.findById(id).lean();
  return o || null;
};


// ========= 客户审核相关（与技师相同逻辑）=========
exports.listCustomers = async ({ status, q, page = 1, pageSize = 20 } = {}) => {
  const query = { role: 'customer' };
  if (status) query.reviewStatus = status;
  if (q) {
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

exports.getCustomer = async (id) => {
  const doc = await User.findOne({ _id: id, role: 'customer' }, {
    username: 1, phone: 1, role: 1, profile: 1, idCard: 1,
    reviewStatus: 1, reviewAudit: 1, reviewHistory: 1, createdAt: 1
  }).lean();
  if (!doc) throw httpError(404, '客户不存在');
  return doc;
};

exports.approveCustomer = async (id, { adminId, adminName } = {}) => {
  const t = new Date();
  const user = await User.findOne({ _id: id, role: 'customer' });
  if (!user) throw httpError(404, '客户不存在');
  if (user.reviewStatus === 'approved') return user;             // 幂等
  if (user.reviewStatus !== 'pending') throw httpError(409, '当前状态不可通过');

  user.reviewStatus = 'approved';
  user.reviewAudit = { auditedAt: t, auditedBy: adminName || adminId || 'admin', result: 'approved', reason: '' };
  user.reviewHistory = user.reviewHistory || [];
  user.reviewHistory.push({ time: t, admin: adminName || adminId || 'admin', result: 'approved', reason: '' });
  await user.save();
  return user.toObject();
};

exports.rejectCustomer = async (id, reason = '', { adminId, adminName } = {}) => {
  const t = new Date();
  const user = await User.findOne({ _id: id, role: 'customer' });
  if (!user) throw httpError(404, '客户不存在');
  if (user.reviewStatus === 'rejected' && user.reviewAudit?.reason === reason) return user; // 幂等
  if (user.reviewStatus !== 'pending') throw httpError(409, '当前状态不可驳回');

  user.reviewStatus = 'rejected';
  user.reviewAudit  = { auditedAt: t, auditedBy: adminName || adminId || 'admin', result: 'rejected', reason: reason || '' };
  user.reviewHistory = user.reviewHistory || [];
  user.reviewHistory.push({ time: t, admin: adminName || adminId || 'admin', result: 'rejected', reason: reason || '' });
  await user.save();
  return user.toObject();
};

// ========== 完成审核通过 ==========
exports.approveComplete = async (id, { adminId = '', adminName = '' } = {}) => {
  const order = await Order.findById(id);
  if (!order) throw httpError(404, '订单不存在');
  if (order.status !== 'awaitingConfirm')
    throw httpError(400, '当前状态不可审核完成');

  const t = now();

  order.status = 'done';
  order.completeFlow = Object.assign({}, order.completeFlow, {
    approvedAt: t,
    approvedBy: adminName || adminId || 'admin'
  });

  order.history = order.history || [];
  order.history.push({
    time: t,
    note: `管理员审核通过，订单已完成`
  });

  await order.save();
  return order.toObject();
};

// ========== 完成审核驳回（打回已签到） ==========
exports.rejectComplete = async (id, reason = '', { adminId = '', adminName = '' } = {}) => {
  const order = await Order.findById(id);
  if (!order) throw httpError(404, '订单不存在');
  if (order.status !== 'awaitingConfirm')
    throw httpError(400, '当前状态不可驳回');

  const t = now();

  order.status = 'checkedIn';   // 打回签到状态
  order.completeFlow = Object.assign({}, order.completeFlow, {
    rejectedAt: t,
    rejectedBy: adminName || adminId || 'admin',
    rejectReason: reason
  });

  order.history = order.history || [];
  order.history.push({
    time: t,
    note: `管理员驳回完成申请${reason ? `（${reason}）` : ''}`
  });

  await order.save();
  return order.toObject();
};
