const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // 兼容老字段（默认用手机号做 username）
  phone:    { type: String, required: true, unique: true },
  password: { type: String, required: true }, // TODO: 上线前改为哈希
  role:     { type: String, enum: ['admin','customer','technician'], default: 'customer' },
  profile: {
    name:   { type: String },
    gender: { type: String, enum: ['male','female'] }
  },
  idCard: {
    name:   { type: String },
    number: { type: String }
  },
  // 客户/师傅使用：注册后进入审核流
  reviewStatus: { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  // 审核审计（最后一次）
  reviewAudit: {
    auditedAt:  { type: Date },
    auditedBy:  { type: String },   // admin id 或用户名
    result:     { type: String, enum: ['approved','rejected'] },
    reason:     { type: String }
  },
  // 审核历史（可选）
  reviewHistory: [{
    time:   { type: Date, default: Date.now },
    admin:  { type: String },
    result: { type: String, enum: ['approved','rejected'] },
    reason: { type: String }
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
