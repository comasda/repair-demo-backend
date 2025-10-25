// services/adminService.js
const Order = require('../models/Order');

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

