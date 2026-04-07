const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
    auctionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction',
        required: true,
    },
    bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    amount: {
        type: Number,
        required: [true, 'Bid amount is required'],
        min: [0, 'Bid amount cannot be negative'],
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});

// ── Index for fast lookup of bids by auction ──
bidSchema.index({ auctionId: 1, amount: -1 });

module.exports = mongoose.model('Bid', bidSchema);
