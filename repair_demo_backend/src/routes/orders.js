const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.detail);
router.put('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.remove);
router.post('/:id/checkin', ctrl.checkin);
router.post('/:id/reviews', ctrl.addReview);
router.get('/:id/review', ctrl.getReview);
router.post('/:id/complete-request', ctrl.requestComplete);
router.post('/:id/complete-confirm', ctrl.confirmComplete);
router.post('/:id/offer', ctrl.offer);
router.post('/:id/accept', ctrl.acceptOffer);
router.post('/:id/decline', ctrl.declineOffer);

module.exports = router;
