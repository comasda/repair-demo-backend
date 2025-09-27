const Order = require('../models/Order');

exports.list = async (req, res, next) => {
  try {
    const { customerId, technicianId } = req.query

    let filter = {}
    if (customerId) {
      filter.customerId = customerId   // 客户看自己的工单
    }
    if (technicianId) {
      filter.technicianId = technicianId   // 师傅看分配给自己的工单
    }

    const items = await Order.find(filter).sort({ createdAt: -1 })
    res.json(items)
  } catch (err) {
    next(err)
  }
};

exports.create = async (req, res, next) => {
  try {
    const { customer, customerId, device, issue, phone, address, images } = req.body;
    if (!customer || !customerId || !device || !issue) {
      return res.status(400).json({ message: '缺少必要字段: customer, customerId, device, issue' });
    }

    const now = new Date();
    const fmt = (d) => {
      const pad = (n) => (n < 10 ? '0' + n : '' + n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    };
    const time = fmt(now);

    const order = await Order.create({
      customer,
      customerId,
      device,
      issue,
      phone,
      address,
      images: images || [],
      time,
      status: 'pending',
      history: [{ time, note: '客户发起报修' }]
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: '工单不存在' });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.assign = async (req, res, next) => {
  try {
    const { id } = req.params
    const { technicianId, technicianName } = req.body

    const order = await Order.findByIdAndUpdate(
      id,
      {
        technicianId,
        technicianName,
        status: 'assigned',
        $push: { history: { time: new Date().toISOString(), note: `已指派给 ${technicianName}` } }
      },
      { new: true }
    )

    if (!order) return res.status(404).json({ message: '订单不存在' })
    res.json(order)
  } catch (err) {
    next(err)
  }
}
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    if (!['pending','assigned','done'].includes(status)) {
      return res.status(400).json({ message: '非法状态值' });
    }
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: '工单不存在' });
    order.status = status;
    order.history.push({ time: new Date().toISOString().slice(0,16).replace('T',' '), note: note || `状态更新为 ${status}` });
    await order.save();
    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ret = await Order.findByIdAndDelete(id);
    if (!ret) return res.status(404).json({ message: '工单不存在' });
    res.json({ message: '删除成功' });
  } catch (err) {
    next(err);
  }
};
