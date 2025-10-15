const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/adminController');

// 健康检查
router.get('/health', (req,res)=>res.json({ ok:true, time:new Date().toISOString(), role:req.user?.role||null }));

// 当前管理员信息
router.get('/me', (req,res)=>res.json({ user:{ id:req.user.sub, username:req.user.username, role:req.user.role }}));

// 订单管理
router.get('/orders', adminCtrl.listOrders);          // 默认 pending，可 ?status=offered/...
router.post('/orders/:id/assign', adminCtrl.assignOrder);

module.exports = router;
