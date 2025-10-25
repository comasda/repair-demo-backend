const adminService = require('../services/adminService');
const ExcelJS = require('exceljs');

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

// 导出订单为 Excel
exports.exportOrders = async (req, res, next) => {
  try {
    const { status, from, to } = req.query || {};
    const orders = await adminService.exportOrders({ status, from, to });

    // 创建 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('订单');

    // 定义表头
    sheet.columns = [
      { header: '订单编号', key: 'id', width: 18 },
      { header: '客户名', key: 'customer', width: 15 },
      { header: '联系电话', key: 'phone', width: 15 },
      { header: '设备', key: 'device', width: 20 },
      { header: '故障描述', key: 'issue', width: 25 },
      { header: '地址', key: 'address', width: 25 },
      { header: '状态', key: 'status', width: 15 },
      { header: '技师姓名', key: 'technicianName', width: 15 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '更新时间', key: 'updatedAt', width: 20 },
    ];

    // 写入数据
    orders.forEach((o) => {
      sheet.addRow({
        id: o.id || o._id,
        customer: o.customer,
        phone: o.phone,
        device: o.device,
        issue: o.issue,
        address: o.address,
        status: o.status,
        technicianName: o.technicianName || '',
        createdAt: new Date(o.createdAt).toLocaleString(),
        updatedAt: new Date(o.updatedAt).toLocaleString(),
      });
    });

    // 响应头
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};
