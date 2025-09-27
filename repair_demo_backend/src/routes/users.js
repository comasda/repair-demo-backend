const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/userController');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.get('/:id', ctrl.getUser);

module.exports = router;
