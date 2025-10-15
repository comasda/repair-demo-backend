const Order = require('../models/Order');

/**
 * 查询订单
 * @param {string} [status] 可选状态
 */
exports.listForAdmin = async (status) => {
  const q = { status: status || 'pending' };
  const items = await Order.find(q).sort({ createdAt: -1 }).lean();
  return items;
};


/**
 * 管理员指派订单
 * @param {string} id 订单ID
 * @param {string} technicianId 技师ID
 * @param {string} technicianName 技师姓名
 */
// 管理员指派（offered）
exports.assignOrder  = async (id, { technicianId, technicianName, adminId, adminName } = {}) => {
  if (!technicianId || !technicianName) throw httpError(400, '缺少参数: technicianId, technicianName');
  const order = await Order.findById(id);
  if (!order) throw httpError(404, '订单不存在');
  if (!['pending', 'offered'].includes(order.status)) throw httpError(400, '当前状态不可指派');

  const time = fmt();
  order.status = 'offered';
  order.technicianId = technicianId;
  order.technicianName = technicianName;
  order.offerFlow = Object.assign({}, order.offerFlow, {
    offeredAt: time,
    offeredBy: adminName || adminId || '',
  });
  order.history = order.history || [];
  order.history.push({ time, note: `管理员指派给 ${technicianName}（待接收）` });
  await order.save();

  const o = order.toObject();
  o.statusText = statusMap[o.status] || o.status;
  return o;
};
