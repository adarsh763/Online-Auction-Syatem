const { validationResult } = require('express-validator');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

/**
 * @route   POST /api/bid
 * @desc    Place a bid on an auction (REST endpoint)
 * @access  Private
 */
const placeBid = async (req, res, next) => {
    try {
        // 1. Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { auctionId, amount } = req.body;
        const bidderId = req.user._id;

        // 2. Find the auction
        const auction = await Auction.findById(auctionId);
        if (!auction) {
            return res
                .status(404)
                .json({ success: false, message: 'Auction not found.' });
        }

        // 3. Verify auction is still active
        if (auction.status !== 'active') {
            return res
                .status(400)
                .json({ success: false, message: 'This auction is no longer active.' });
        }

        if (new Date() > new Date(auction.endTime)) {
            return res
                .status(400)
                .json({ success: false, message: 'This auction has ended.' });
        }

        // 4. Prevent seller from bidding on their own auction
        if (auction.seller.toString() === bidderId.toString()) {
            return res
                .status(403)
                .json({ success: false, message: 'You cannot bid on your own auction.' });
        }

        // 5. Validate bid is higher than the current highest bid
        if (amount <= auction.currentHighestBid) {
            return res.status(400).json({
                success: false,
                message: `Bid must be higher than the current highest bid of $${auction.currentHighestBid}.`,
            });
        }

        // 6. Atomically update auction to prevent race conditions
        const updatedAuction = await Auction.findOneAndUpdate(
            { _id: auctionId, currentHighestBid: { $lt: amount } },
            { currentHighestBid: amount, highestBidder: bidderId },
            { new: true }
        );

        if (!updatedAuction) {
            return res.status(409).json({
                success: false,
                message: 'Someone placed a higher bid just before you. Please try again.',
            });
        }

        // 7. Save bid record
        const bid = await Bid.create({
            auctionId,
            bidder: bidderId,
            amount,
        });

        // 8. Broadcast bid update to all Socket.io clients in the auction room
        const io = req.app.get('io');
        if (io) {
            io.to(auctionId).emit('bidUpdate', {
                bid: {
                    id: bid._id,
                    amount: bid.amount,
                    bidder: { id: req.user._id, name: req.user.name },
                    timestamp: bid.timestamp,
                },
                currentHighestBid: updatedAuction.currentHighestBid,
                highestBidder: { id: req.user._id, name: req.user.name },
            });
        }

        res.status(201).json({
            success: true,
            message: 'Bid placed successfully.',
            data: {
                bid,
                currentHighestBid: updatedAuction.currentHighestBid,
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { placeBid };
