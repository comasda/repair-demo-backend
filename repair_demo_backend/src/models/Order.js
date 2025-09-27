const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  time: { type: String, required: true },
  note: { type: String, required: true }
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
  time: { type: String, required: true },           // 创建时间
  status: { type: String, enum: ['pending','assigned','done'], default: 'pending' },
  technicianId: { type: String, default: null },
  technicianName: { type: String, default: null },
  history: { type: [historySchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
