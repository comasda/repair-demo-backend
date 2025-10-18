const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
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
  // 仅师傅使用：注册后进入审核流
  reviewStatus: { type: String, enum: ['pending','approved','rejected'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
