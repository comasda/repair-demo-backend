const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/technicianController');

// router.get('/', ctrl.list);
// router.post('/', ctrl.create);

router.get('/mine', verifyJWT, requireRole('technician'), ctrl.listMine);            // 我的工单（只看被指派/在处理中）
router.post('/:id/checkin', verifyJWT, requireRole('technician'), ctrl.checkin);
router.put('/:id/status', verifyJWT, requireRole('technician'), ctrl.updateStatus);  // 如需
router.post('/:id/accept', verifyJWT, requireRole('technician'), ctrl.acceptOffer);
router.post('/:id/decline', verifyJWT, requireRole('technician'), ctrl.declineOffer);
router.post('/:id/complete-request', verifyJWT, requireRole('technician'), ctrl.requestComplete);
router.get('/:id/review', verifyJWT, ctrl.getReview);

module.exports = router;
