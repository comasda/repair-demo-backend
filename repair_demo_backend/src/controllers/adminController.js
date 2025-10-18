const adminService = require('../services/adminService');

// 列出订单
exports.listOrders = async (req, res, next) => {
  try {
    const { status } = req.query || {};
    const orders = await adminService.listForAdmin(status);
    res.json(orders || []);
  } catch (err) {
    next(err);
  }
};

// 指派订单
exports.assignOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { technicianId, technicianName } = req.body || {};
    if (!technicianId) return res.status(400).json({ message: '缺少技师ID' });

    const adminInfo = {
      adminId: req.user?.sub || '',
      adminName: req.user?.username || 'admin',
    };

    const order = await adminService.assignOrder(id, {
      technicianId,
      technicianName: technicianName || '',
      ...adminInfo,
    });

    if (!order) return res.status(404).json({ message: '订单不存在' });

    res.json({ ok: true, data: order, message: '指派成功' });
  } catch (err) {
    next(err);
  }
};
