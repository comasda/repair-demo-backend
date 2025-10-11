const Order = require('../models/Order');

const statusMap = { pending: '待接单', assigned: '已接单', done: '已完成' };
const CHECKIN_RADIUS_M = Number(process.env.CHECKIN_RADIUS_M || 200)
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

    const items = await Order.find(filter).sort({ createdAt: -1 });

    const mapped = items.map(d => {
      const o = d.toObject();
      o.statusText = statusMap[o.status] || o.status;
      return o;
    });

    res.json(mapped);
  } catch (err) {
    next(err)
  }
};

exports.create = async (req, res, next) => {
  try {
    const { customer, customerId, device, issue, phone, address, images, location, locationAddress} = req.body;
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
      location: location || {},
      locationAddress: locationAddress || '',
      time,
      status: 'pending',
      history: [{ time, note: '客户发起报修' }]
    });
    // 返回中文状态
    const statusMap = { pending: '待接单', assigned: '已接单', done: '已完成' }
    const o = order.toObject()
    o.statusText = statusMap[o.status] || o.status
    res.json(o);
  } catch (err) {
    next(err);
  }
};

exports.detail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: '工单不存在' });
    const statusMap = { pending: '待接单', assigned: '已接单', done: '已完成' }
    const o = order.toObject()
    o.statusText = statusMap[o.status] || o.status
    res.json(o)
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

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

exports.checkin = async (req, res, next) => {
  try {
    const { id } = req.params
    const { lat, lng, technicianId, technicianName } = req.body
    if (lat == null || lng == null || !technicianId || !technicianName) {
      return res.status(400).json({ message: '缺少必要参数' })
    }

    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: '订单不存在' })

    // 兼容两种存法
    const oLat = order.location?.lat ?? order.lat
    const oLng = order.location?.lng ?? order.lng
    if (oLat == null || oLng == null) {
      return res.status(400).json({ message: '工单未配置坐标，无法签到' })
    }

    const dist = Math.round(haversine(lat, lng, oLat, oLng))
    if (dist > CHECKIN_RADIUS_M) {
      return res.status(400).json({ message: `距工单位置约${dist}米，需在${CHECKIN_RADIUS_M}米内签到` })
    }

    const now = new Date()
    const pad = n => (n < 10 ? '0' + n : '' + n)
    const time = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

    const updated = await Order.findByIdAndUpdate(
      id,
      {
        $push: {
          checkins: { time, lat, lng, technicianId, technicianName },
          history:  { time, note: `师傅签到（${technicianName}）` }
        }
      },
      { new: true }
    )
    res.json(updated)
  } catch (e) { next(e) }
}
