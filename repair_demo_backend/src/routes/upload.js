// routes/upload.js
const express = require('express');
const router = express.Router();

const { uploader } = require('../middleware/upload');
const ctrl = require('../controllers/uploadController');
const { verifyJWT } = require('../middleware/auth');

router.post('/', verifyJWT, uploader.single('file'), ctrl.single);

module.exports = router;
