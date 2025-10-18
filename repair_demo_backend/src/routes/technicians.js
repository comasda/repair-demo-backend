const express = require('express');
const router = express.Router();
const { verifyJWT, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/technicianController');

// router.get('/', ctrl.list);
// router.post('/', ctrl.create);

router.get('/mine', verifyJWT, requireRole('technician'), ctrl.listMine);
router.post('/:id/checkin', verifyJWT, requireRole('technician'), ctrl.checkin);
router.put('/:id/status', verifyJWT, requireRole('technician'), ctrl.updateStatus);  // 如需
router.post('/:id/accept', verifyJWT, requireRole('technician'), ctrl.acceptOffer);
router.post('/:id/decline', verifyJWT, requireRole('technician'), ctrl.declineOffer);
router.post('/:id/complete-request', verifyJWT, requireRole('technician'), ctrl.requestComplete);
router.get('/:id/review', verifyJWT, requireRole('technician'), ctrl.getReview);

router.get('/', verifyJWT, requireRole('admin'), ctrl.listAll);
router.get('/approved', verifyJWT, requireRole('admin'), ctrl.listApproved);

module.exports = router;
