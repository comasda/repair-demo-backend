const Order = require('../models/Order');

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

// 抛出带 HTTP 状态码的异常，controller 捕获后统一返回
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

exports.create = async ({
  customer,
  customerId,
  device,
  issue,
  phone,
  address,
  images,
  location,
  locationAddress,
}) => {
  if (!customer || !customerId || !device || !issue) {
    throw httpError(400, '缺少必要字段: customer, customerId, device, issue');
  }
  const time = fmt(new Date());
  const doc = await Order.create({
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
    history: [{ time, note: '客户发起报修' }],
  });
  const o = doc.toObject();
  o.statusText = statusMap[o.status] || o.status;
  return o;
};

exports.listForCustomer = async (customerId) => {
  return Order.find({ customerId }).sort({ createdAt: -1 }).lean();
};

// 详情（权限安全版：仅相关人/管理员）
exports.getByIdSafe = async (id, user) => {
  const doc = await Order.findById(id).lean();
  if (!doc) return null;
  if (user?.role === 'admin') return doc;
  if (user?.role === 'technician' && String(doc.technicianId) === String(user.sub)) return doc;
  if (user?.role === 'customer' && String(doc.customerId) === String(user.sub)) return doc;
  return null;
};

// 客户确认完成（需 awaitingConfirm）
exports.confirmComplete = async (id, customerId) => {
  if (!customerId) throw httpError(400, '缺少参数: customerId');

  const order = await Order.findById(id);
  if (!order) throw httpError(404, '工单不存在');
  if (order.customerId !== customerId) throw httpError(403, '仅下单客户可确认完成');
  if (order.status !== 'awaitingConfirm') throw httpError(400, '当前状态不可确认完成');

  const time = fmt(new Date());
  order.status = 'done';
  order.completeFlow = Object.assign({}, order.completeFlow, {
    confirmAt: time,
    confirmedBy: customerId,
  });
  order.history = order.history || [];
  order.history.push({ time, note: '客户确认完成' });
  await order.save();
  return { message: '订单已完成', status: order.status };
};


exports.addReview = async (id, { customerId, customerName, rating, content, images }) => {
  if (!customerId || !rating) throw httpError(400, '缺少必要字段: customerId, rating');

  const r = Number(rating);
  if (Number.isNaN(r) || r < 1 || r > 5) throw httpError(400, '评分须为 1~5 的数字');

  const order = await Order.findById(id);
  if (!order) throw httpError(404, '工单不存在');
  if (order.customerId !== customerId) throw httpError(403, '仅该订单的客户可评价');
  if (order.status !== 'done') throw httpError(400, '订单未完成，无法评价');

  const time = fmt(new Date());
  await Order.findByIdAndUpdate(
    id,
    {
      $push: {
        reviews: {
          time,
          customerId,
          customerName: customerName || order.customer,
          rating: r,
          content: content || '',
          images: images || [],
        },
        history: { time, note: `客户追加评价（${r}星）` },
      },
    },
    { new: true }
  );
  return { message: '评价成功' };
};