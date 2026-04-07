const express = require('express');
const router = express.Router();
const { placeBid } = require('../controllers/bidController');
const { protect } = require('../middlewares/auth');
const { bidValidation } = require('../utils/validators');

// POST /api/bid  (Protected)
router.post('/bid', protect, bidValidation, placeBid);

module.exports = router;
