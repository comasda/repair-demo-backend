const Order = require('../models/Order');
const User = require('../models/User');

const CHECKIN_RADIUS_M = Number(process.env.CHECKIN_RADIUS_M || 200);

const statusMap = {
  pending: '待接单',
  offered: '待接收',
  assigned: '待签到',
  checkedIn: '已签到',
  awaitingConfirm: '待客户确认',
  done: '已完成',
};

// 标准化时间文本：YYYY-MM-DD HH:mm
const fmt = (d = new Date()) => {
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
};

const CHECKIN_MEDIA_CATEGORIES = ['front', 'circuit', 'qrcode', 'site', 'finish'];

// ★ 每个类别的数量限制（可自定义）
const CHECKIN_MEDIA_LIMIT = {
  front:   { min: 1, max: Number(process.env.CHECKIN_FRONT_MAX   || 1) },
  circuit: { min: 1, max: Number(process.env.CHECKIN_CIRCUIT_MAX || 1) },
  qrcode:  { min: 1, max: Number(process.env.CHECKIN_QRCODE_MAX  || 1) },
  site:    { min: 1, max: Number(process.env.CHECKIN_SITE_MAX    || 1) },
  finish:  { min: 1, max: Number(process.env.CHECKIN_FINISH_MAX  || 1) },
};

// 将单个对象或数组统一成数组
function normalizeMediaValue(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

//计算距离
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 师傅工单列表
exports.listForTechnician = async (technicianId, status) => {
  const q = {technicianId};
  if (status) q.status = status;             // 单状态过滤（前端会做多状态合并）
  return Order.find(q).sort({ createdAt: -1 }).lean();
};

// 师傅 签到
exports.checkin = async (id, { lat = null, lng = null, technicianId, technicianName }) => {
  if (!technicianId || !technicianName) {
    throw httpError(400, '缺少必要参数');
  }
  const order = await Order.findById(id);
  if (!order) throw httpError(404, '订单不存在');

  const willSetStatus = order.status !== 'done' ? { status: 'checkedIn' } : {};

  const time = fmt(new Date());

  const updated = await Order.findByIdAndUpdate(
    id,
    {
      ...willSetStatus,
      $push: {
        checkins: { time, lat, lng, technicianId, technicianName },
        history: { time, note: `师傅签到（${technicianName}）` },
      },
    },
    { new: true }
  );
  return updated;
};

// 更新状态（仅允许正常过渡，禁止直接 done/awaitingConfirm）
exports.updateStatus = async (id, status, note) => {
  if (!['pending', 'assigned', 'checkedIn', 'awaitingConfirm', 'done'].includes(status)) {
    throw httpError(400, '非法状态值');
  }
  if (status === 'done') throw httpError(400, '请使用 /complete-confirm 完成用户确认流程');
  if (status === 'awaitingConfirm') throw httpError(400, '请使用 /complete-request 发起完成确认');

  const order = await Order.findById(id);
  if (!order) throw httpError(404, '工单不存在');

  order.status = status;
  order.history.push({
    time: fmt(new Date()),
    note: note || `状态更新为 ${statusMap[status] || status}`,
  });
  await order.save();
  return order;
};

// 师傅接受指派 → assigned
exports.acceptOffer = async (id, technicianId) => {
  if (!technicianId) throw httpError(400, '缺少参数: technicianId');

  const order = await Order.findById(id);
  if (!order) throw httpError(404, '订单不存在');
  if (order.status !== 'offered' || order.technicianId !== technicianId) {
    throw httpError(400, '当前不可接受该指派');
  }
  const time = fmt();
  order.status = 'assigned';
  order.offerFlow = Object.assign({}, order.offerFlow, { acceptedAt: time });
  order.history = order.history || [];
  order.history.push({ time, note: '师傅已接受指派' });
  await order.save();

  const o = order.toObject();
  o.statusText = statusMap[o.status] || o.status;
  return o;
};

// 师傅拒绝指派 → 回 pending（清空技师）
exports.declineOffer = async (id, technicianId, note = '') => {
  if (!technicianId) throw httpError(400, '缺少参数: technicianId');

  const order = await Order.findById(id);
  if (!order) throw httpError(404, '订单不存在');
  if (order.status !== 'offered' || order.technicianId !== technicianId) {
    throw httpError(400, '当前不可拒绝该指派');
  }
  const time = fmt();
  order.status = 'pending';
  order.offerFlow = Object.assign({}, order.offerFlow, { declinedAt: time, declineNote: note || '' });
  order.history = order.history || [];
  order.history.push({ time, note: `师傅拒绝指派${note ? '：' + note : ''}` });
  // 清空技师，便于管理员重新指派
  order.technicianId = null;
  order.technicianName = null;
  await order.save();

  const o = order.toObject();
  o.statusText = statusMap[o.status] || o.status;
  return o;
};

// 师傅发起完成（需 checkedIn）
exports.requestComplete = async (id, payload = {}) => {
  const { technicianId, checkinImages = [], checkinMedia = {} } = payload;

  if (!technicianId) throw httpError(400, '缺少参数: technicianId');

  const order = await Order.findById(id);
  if (!order) throw httpError(404, '工单不存在');
  if (order.technicianId !== technicianId) throw httpError(403, '仅接单的师傅可发起完成');
  if (order.status !== 'checkedIn') throw httpError(400, '需到场签到后才能发起完成');

  // ★ 1）按类别校验 & 归一化
  const normalized = {};
  CHECKIN_MEDIA_CATEGORIES.forEach((cat) => {
    const limit = CHECKIN_MEDIA_LIMIT[cat] || { min: 0, max: 10 };
    const raw = normalizeMediaValue(checkinMedia[cat]);

    const count = raw.length;
    if (count < limit.min) {
      throw httpError(400, `请至少上传 ${limit.min} 个「${cat}」媒资`);
    }
    if (count > limit.max) {
      throw httpError(400, `「${cat}」媒资最多只能上传 ${limit.max} 个`);
    }

    normalized[cat] = raw.map((item) => {
      // 支持两种格式：{url,type} 或 直接是字符串 url
      if (typeof item === 'string') {
        return { url: item, type: 'image' };
      }
      return {
        url: item.url,
        type: item.type === 'video' ? 'video' : 'image',
      };
    });
  });

  // ★ 2）保存到订单
  order.checkinMedia = normalized;

  // 为了兼容管理端已有的预览逻辑，保留一维数组（按前端顺序）
  if (Array.isArray(checkinImages) && checkinImages.length) {
    order.checkinImages = checkinImages;
  }

  // ★ 3）更新状态 & 完成流程
  const time = fmt(new Date());
  order.status = 'awaitingConfirm';
  order.completeFlow = Object.assign({}, order.completeFlow, {
    requestAt: time,
    requestedBy: technicianId,
  });

  order.history = order.history || [];
  order.history.push({ time, note: '师傅发起完成，等待平台审核' });

  await order.save();
  return {
    message: '已发起完成申请，等待平台审核',
    status: order.status,
  };
};

// 查看评价
exports.getReview = async (id, { technicianId } = {}) => {
  const order = await Order.findById(id);
  if (!order) throw httpError(404, '工单不存在');

  // 仅该工单的师傅可查看（如果带了 technicianId）
  if (technicianId && order.technicianId !== technicianId) {
    throw httpError(403, '仅该工单的师傅可查看评价');
  }

  if (!order.reviews || order.reviews.length === 0) return { reviews: [] };

  return {
    reviews: order.reviews.map((r) => ({
      time: r.time,
      rating: r.rating,
      content: r.content,
      images: r.images || [],
      customerName: r.customerName || '用户',
    })),
  };
};

// 管理员：获取技师列表（支持关键词 q）
exports.listAll = async (q) => {
  const query = { role: 'technician' };
  if (q) {
    // 你当前 User 模型字段是 username
    query.username = new RegExp(q, 'i');
  }
  // 只返回必要字段，避免把 password 带出去！
  return User.find(query, { username: 1 }) // 仅选出 _id, username
    .sort({ createdAt: -1 })
    .lean();
};

// 管理员：获取审核通过的技师列表（用于指派）
exports.listApproved = async (q) => {
  const query = { role: 'technician', reviewStatus: 'approved' };

  if (q) {
    // 支持姓名或手机号模糊匹配
    query.$or = [
      { 'idCard.name': new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
    ];
  }

  // 只返回必要字段
  const list = await User.find(query, {
    _id: 1,
    phone: 1,
    'idCard.name': 1,
  })
    .sort({ createdAt: -1 })
    .lean();

  // 格式化字段兼容前端
  return list.map((u) => ({
    _id: u._id,
    name: u.idCard?.name || '',
    phone: u.phone,
  }));
};
