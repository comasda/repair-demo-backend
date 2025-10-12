const Order = require('../models/Order');

const statusMap = { pending: '待接单', assigned: '待签到', checkedIn: '已签到', awaitingConfirm: '待客户确认', done: '已完成' };
const CHECKIN_RADIUS_M = Number(process.env.CHECKIN_RADIUS_M || 200)
const fmt = (d=new Date()) => { const p=n=>n<10?'0'+n:''+n; return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }

exports.list = async (req, res, next) => {
  try {
    const { customerId, technicianId, status } = req.query

    let filter = {}
    if (customerId) {
      filter.customerId = customerId   // 客户看自己的工单
    }
    if (technicianId) {
      filter.technicianId = technicianId   // 师傅看分配给自己的工单
    }
    if (status) filter.status = status

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
    if (!['pending','assigned','checkedIn','awaitingConfirm','done'].includes(status)) {
      return res.status(400).json({ message: '非法状态值' });
    }
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: '工单不存在' });
   // 收紧直改：禁止绕过流程直接 done，禁止越级写 awaitingConfirm
    if (status === 'done') {
      return res.status(400).json({ message: '请使用 /complete-confirm 完成用户确认流程' });
    }
    if (status === 'awaitingConfirm') {
      return res.status(400).json({ message: '请使用 /complete-request 发起完成确认' });
    }
    order.status = status;
    order.history.push({ time: new Date().toISOString().slice(0,16).replace('T',' '), note: note || `状态更新为 ${statusMap[status] || status}` });
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
    
    const willSetStatus = (order.status !== 'done') ? { status: 'checkedIn' } : {}

    const time = fmt(new Date())

    const updated = await Order.findByIdAndUpdate(
      id,
      {
        ...willSetStatus,
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

exports.addReview = async (req, res, next) => {
  try {
    const { id } = req.params
    const { customerId, customerName, rating, content, images } = req.body || {}

    // 1) 基础校验
    if (!customerId || !rating) {
      return res.status(400).json({ message: '缺少必要字段: customerId, rating' })
    }
    const r = Number(rating)
    if (Number.isNaN(r) || r < 1 || r > 5) {
      return res.status(400).json({ message: '评分须为 1~5 的数字' })
    }

    // 2) 订单校验：存在性、归属、状态
    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: '工单不存在' })
    if (order.customerId !== customerId) {
      return res.status(403).json({ message: '仅该订单的客户可评价' })
    }
    if (order.status !== 'done') {
      return res.status(400).json({ message: '订单未完成，无法评价' })
    }

    // 3) 生成时间、写入评论 + 留痕
    const now = new Date()
    const pad = n => (n < 10 ? '0' + n : '' + n)
    const time = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

    await Order.findByIdAndUpdate(
      id,
      {
        $push: {
          reviews: { time, customerId, customerName: customerName || order.customer, rating: r, content: content || '', images: images || [] },
          history: { time, note: `客户追加评价（${r}星）` }
        }
      },
      { new: true }
    )

    res.json({ message: '评价成功' })
  } catch (err) {
    next(err)
  }
}

exports.getReview = async (req, res, next) => {
  try {
    const { id } = req.params
    const { technicianId } = req.query || {}

    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: '工单不存在' })

    // 权限：仅该工单的师傅可查看
    if (technicianId && order.technicianId !== technicianId) {
      return res.status(403).json({ message: '仅该工单的师傅可查看评价' })
    }

    // 无评价
    if (!order.reviews || order.reviews.length === 0) {
      return res.json({ reviews: [] })
    }

    res.json({
      reviews: order.reviews.map(r => ({
        time: r.time,
        rating: r.rating,
        content: r.content,
        images: r.images || [],
        customerName: r.customerName || '用户',
      }))
    })
  } catch (err) {
    next(err)
  }
}

// ===== 师傅发起完成请求（需已签到）=====
exports.requestComplete = async (req, res, next) => {
  try {
    const { id } = req.params
    const { technicianId } = req.body || {}
    if (!technicianId) return res.status(400).json({ message: '缺少参数: technicianId' })

    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: '工单不存在' })
    if (order.technicianId !== technicianId) {
      return res.status(403).json({ message: '仅接单的师傅可发起完成' })
    }
    if (order.status !== 'checkedIn') {
      return res.status(400).json({ message: '需到场签到后才能发起完成' })
    }

    const time = fmt(new Date())
    order.status = 'awaitingConfirm'
    order.completeFlow = Object.assign({}, order.completeFlow, {
      requestAt: time,
      requestedBy: technicianId
    })
    order.history.push({ time, note: '师傅发起完成，等待客户确认' })
    await order.save()
    res.json({ message: '已发起完成确认', status: order.status })
  } catch (err) { next(err) }
}

// ===== 客户确认完成（需待确认状态）=====
exports.confirmComplete = async (req, res, next) => {
  try {
    const { id } = req.params
    const { customerId } = req.body || {}
    if (!customerId) return res.status(400).json({ message: '缺少参数: customerId' })

    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: '工单不存在' })
    if (order.customerId !== customerId) {
      return res.status(403).json({ message: '仅下单客户可确认完成' })
    }
    if (order.status !== 'awaitingConfirm') {
      return res.status(400).json({ message: '当前状态不可确认完成' })
    }

    const time = fmt(new Date())
    order.status = 'done'
    order.completeFlow = Object.assign({}, order.completeFlow, {
      confirmAt: time,
      confirmedBy: customerId
    })
    order.history.push({ time, note: '客户确认完成' })
    await order.save()
    res.json({ message: '订单已完成', status: order.status })
  } catch (err) { next(err) }
}