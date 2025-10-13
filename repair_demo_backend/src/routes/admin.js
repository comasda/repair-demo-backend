const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ ok: true, role: req.user?.role || null, time: new Date().toISOString() });
});

router.get('/me', (req, res) => {
  // 只有通过 verifyJWT + requireRole('admin') 才能到这里
  res.json({ user: { id: req.user.sub, username: req.user.username, role: req.user.role } });
});

// ===== 这里开始新增管理员订单接口 =====
const Order = require('../models/Order'); // 请确保有该模型

// GET /api/admin/orders?status=pending
router.get('/orders', async (req, res, next) => {
  try {
    const { status } = req.query || {};
    const q = {};
    if (status) q.status = status;
    const items = await Order.find(q).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (e) { next(e); }
});

// POST /api/admin/orders/:id/assign  { technicianId, technicianName }
router.post('/orders/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { technicianId, technicianName } = req.body || {};
    if (!technicianId) return res.status(400).json({ message: '缺少技师ID' });
    const doc = await Order.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'offered',
          technicianId,
          technicianName,
          offer: { techId: technicianId, expiresAt: new Date(Date.now() + 15*60*1000) }
        }
      },
      { new: true }
    ).lean();
    if (!doc) return res.status(404).json({ message: '订单不存在' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});


module.exports = router;
