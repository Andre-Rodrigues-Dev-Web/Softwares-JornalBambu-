const express = require('express');
const router = express.Router();
const ConverterController = require('../controllers/ConverterController');

router.post('/scan-directory', (req, res) => ConverterController.scan(req, res));
router.post('/convert', (req, res) => ConverterController.convert(req, res));
router.get('/convert-stream', (req, res) => ConverterController.convertStream(req, res));

module.exports = router;
