const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/customerController');

router.post('/', verifyJWT, requireRole('customer'), ctrl.create);                // 下单
router.get('/', verifyJWT, requireRole('customer'), ctrl.listMine);              // 我的订单列表（客户）
router.get('/:id', verifyJWT, ctrl.detailSafe);                                  // 详情（相关方可见）
router.post('/:id/complete-confirm', verifyJWT, requireRole('customer'), ctrl.confirmComplete);
router.post('/:id/reviews', verifyJWT, requireRole('customer'), ctrl.addReview);
router.post('/:id/cancel', verifyJWT, requireRole('customer'), ctrl.cancel);  

 module.exports = router;