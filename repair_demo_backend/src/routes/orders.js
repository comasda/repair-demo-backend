const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/orderController');

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.detail);
router.put('/:id/assign', ctrl.assign);
router.put('/:id/status', ctrl.updateStatus);
router.delete('/:id', ctrl.remove);

module.exports = router;
