const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Auction title is required'],
            trim: true,
            maxlength: [120, 'Title cannot exceed 120 characters'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
        },
        startingPrice: {
            type: Number,
            required: [true, 'Starting price is required'],
            min: [0, 'Starting price cannot be negative'],
        },
        currentHighestBid: {
            type: Number,
            default: 0,
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        highestBidder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        endTime: {
            type: Date,
            required: [true, 'End time is required'],
        },
        image: {
            type: String,
            default: '',
        },
        status: {
            type: String,
            enum: ['pending', 'active', 'completed'],
            default: 'active',
        },
    },
    {
        timestamps: true,
    }
);

// ── Index for efficient queries on status and endTime ──
auctionSchema.index({ status: 1, endTime: 1 });

module.exports = mongoose.model('Auction', auctionSchema);
