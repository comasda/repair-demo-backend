const adminService = require('../services/adminService');
const ExcelJS = require('exceljs');
const uploadService = require('../services/uploadService');

// 工具：把图片地址转为绝对URL
function absolutizeImages(req, images = []) {
  return (images || []).map((u) => {
    if (!u) return u;
    // 1) 已经是 http(s) 绝对地址 -> 原样返回
    if (/^https?:\/\//i.test(u)) return u;
    // 2) /api/uploads/xxx -> 转为带域名的绝对地址
    if (u.startsWith('/api/uploads/')) {
      const filename = u.replace('/api/uploads/', '');
      return uploadService.buildPublicUrl(req, filename);
    }
    // 3) 仅有文件名 -> 也转绝对地址
    return uploadService.buildPublicUrl(req, u);
  });
}

// 列出订单
exports.listOrders = async (req, res, next) => {
  try {
    const { status } = req.query || {};
    const orders = await adminService.listForAdmin(status);
    const data = (orders || []).map(o => ({
      ...o,
      images: absolutizeImages(req, o.images)
    }));
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// 获取订单详情（含绝对URL的图片）
exports.getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const o = await adminService.getOrderById(id);
    if (!o) return res.status(404).json({ message: '订单不存在' });
    o.images = absolutizeImages(req, o.images);
    // 如果后面还会预览评价图片，也可一并绝对化
    if (Array.isArray(o.reviews)) {
      o.reviews = o.reviews.map(r => ({
        ...r,
        images: absolutizeImages(req, r.images)
      }));
    }
    res.json(o);
  } catch (e) { next(e); }
}

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

// ========= 技师审核 =========
exports.listTechnicians = async (req, res, next) => {
  try {
    const { status, q, page, pageSize } = req.query || {};
    const data = await adminService.listTechnicians({ status, q, page, pageSize });
    res.json(data);
  } catch (e) { next(e); }
};

exports.getTechnician = async (req, res, next) => {
  try {
    const data = await adminService.getTechnician(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
};

exports.approveTechnician = async (req, res, next) => {
  try {
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.approveTechnician(req.params.id, { adminId, adminName });
    res.json({ ok: true, message: '审核已通过', data });
  } catch (e) { next(e); }
};

exports.rejectTechnician = async (req, res, next) => {
  try {
    const reason = req.body?.reason || '';
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.rejectTechnician(req.params.id, reason, { adminId, adminName });
    res.json({ ok: true, message: '已驳回', data });
  } catch (e) { next(e); }
};

// 管理员修改订单状态
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body || {};
    if (!status) return res.status(400).json({ message: '缺少目标状态 status' });

    const adminInfo = {
      adminId: req.user?.sub || '',
      adminName: req.user?.username || 'admin',
    };

    const updated = await adminService.updateOrderStatus(id, status, {
      reason: reason || '',
      ...adminInfo,
    });
    res.json({ ok: true, data: updated, message: '状态已更新' });
  } catch (err) {
    next(err);
  }
};

// ========= 客户审核（与技师审核同结构）=========
exports.listCustomers = async (req, res, next) => {
  try {
    const { status, q, page, pageSize } = req.query || {};
    const data = await adminService.listCustomers({ status, q, page, pageSize });
    res.json(data);
  } catch (e) { next(e); }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const data = await adminService.getCustomer(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
};

exports.approveCustomer = async (req, res, next) => {
  try {
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.approveCustomer(req.params.id, { adminId, adminName });
    res.json({ ok: true, message: '审核已通过', data });
  } catch (e) { next(e); }
};

exports.rejectCustomer = async (req, res, next) => {
  try {
    const reason = req.body?.reason || '';
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.rejectCustomer(req.params.id, reason, { adminId, adminName });
    res.json({ ok: true, message: '已驳回', data });
  } catch (e) { next(e); }
};

// ========== 完成审核：管理员同意 ==========
exports.approveComplete = async (req, res, next) => {
  try {
    const adminId = req.user?.sub || '';
    const adminName = req.user?.username || 'admin';
    const result = await adminService.approveComplete(req.params.id, {
      adminId,
      adminName
    });
    res.json({ ok: true, message: '订单已审核通过', data: result });
  } catch (err) {
    next(err);
  }
};

// ========== 完成审核：管理员驳回 ==========
exports.rejectComplete = async (req, res, next) => {
  try {
    const adminId = req.user?.sub || '';
    const adminName = req.user?.username || 'admin';
    const reason = req.body?.reason || '';
    const result = await adminService.rejectComplete(req.params.id, reason, {
      adminId,
      adminName
    });
    res.json({ ok: true, message: '已驳回完成申请', data: result });
  } catch (err) {
    next(err);
  }
};
