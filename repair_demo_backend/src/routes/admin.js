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
router.get('/orders/export', adminCtrl.exportOrders);
// 技师审核
router.get('/technicians', adminCtrl.listTechnicians);
router.get('/technicians/:id', adminCtrl.getTechnician);
router.post('/technicians/:id/approve', adminCtrl.approveTechnician);
router.post('/technicians/:id/reject', adminCtrl.rejectTechnician);
router.post('/orders/:id/status', adminCtrl.updateOrderStatus);
router.get('/orders/:id', adminCtrl.getOrder);

// 客户审核
router.get('/customers', adminCtrl.listCustomers);
router.get('/customers/:id', adminCtrl.getCustomer);
router.post('/customers/:id/approve', adminCtrl.approveCustomer);
router.post('/customers/:id/reject', adminCtrl.rejectCustomer);

// ★ 完成审核：管理员通过 / 驳回
router.post('/orders/:id/complete-approve', adminCtrl.approveComplete);
router.post('/orders/:id/complete-reject', adminCtrl.rejectComplete);

module.exports = router;
