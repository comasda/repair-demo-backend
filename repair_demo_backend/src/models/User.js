const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // NOTE: plaintext for MVP; replace with bcrypt in production
  role: { type: String, enum: ['admin','customer','technician'], default: 'customer' }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
