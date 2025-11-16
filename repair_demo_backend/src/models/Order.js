const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  time: { type: String, required: true },
  note: { type: String, required: true }
}, { _id: false });

const checkinSchema = new mongoose.Schema({
  time:   { type: String, required: true },       // 前端传格式化时间，或后端生成
  lat:    { type: Number, required: true },
  lng:    { type: Number, required: true },
  address:{ type: String, default: '' },          // 可选，前端 chooseLocation 的地址
  technicianId:   { type: String, required: true },
  technicianName: { type: String, required: true },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  time: { type: String, required: true },
  customerId: { type: String, required: true },
  customerName: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 5, required: true },
  content: { type: String, default: '' },
  images: { type: [String], default: [] }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  id: { type: String }, // 工单编号
  customer: { type: String, required: true },       // 客户名（或手机号）
  customerId: { type: String, required: true },     // 客户 ID（来自用户表）
  device: { type: String, required: true },         // 设备名称
  issue: { type: String, required: true },          // 故障描述
  phone: { type: String },                          // 联系电话
  address: { type: String },                        // 地址
  images: { type: [String], default: [] },          // 图片 URL 列表
  location: {
    lat: { type: Number }, // 客户未授权时可为空
    lng: { type: Number }
  },
  locationAddress: { type: String, default: '' }, // chooseLocation 的可读地址
  time: { type: String, required: true },           // 创建时间
  status: { type: String, enum: ['pending','offered','assigned','checkedIn','awaitingConfirm','done','cancelled'], default: 'pending' },
  technicianId: { type: String, default: null },
  technicianName: { type: String, default: null },
  history: { type: [historySchema], default: [] },
  checkins: { type: [checkinSchema], default: [] },
  reviews: { type: [reviewSchema], default: [] },
  checkinImages: { type: [String], default: [] },
  // 指派-接受-拒绝的审计痕迹
  offerFlow: {
    offeredAt:   { type: String, default: '' },  // 管理员指派时间
    offeredBy:   { type: String, default: '' },  // 管理员ID/名字（可空）
    acceptedAt:  { type: String, default: '' },  // 师傅接受时间
    declinedAt:  { type: String, default: '' },  // 师傅拒绝时间
    declineNote: { type: String, default: '' }   // 拒绝原因
  },
  // 取消记录（软删除语义）
  cancelFlow: {
    cancelledAt: { type: String, default: '' },
    cancelledBy: { type: String, default: '' },   // customerId
    reason:      { type: String, default: '' }
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
