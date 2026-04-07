const express = require('express');
const router = express.Router();
const {
    createAuction,
    getAllAuctions,
    getAuctionById,
} = require('../controllers/auctionController');
const { protect } = require('../middlewares/auth');
const upload = require('../middleware/uploadMiddleware'); // Fixed path
const { auctionValidation } = require('../utils/validators');

// POST /api/auction/create  (Protected)
router.post('/auction/create', protect, upload.single('image'), auctionValidation, createAuction); // Modified this line

// GET /api/auctions
router.get('/auctions', getAllAuctions);

// GET /api/auction/:id
router.get('/auction/:id', getAuctionById);

module.exports = router;
