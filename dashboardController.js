const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

/**
 * @route   GET /api/dashboard
 * @desc    Get dashboard data for the authenticated user
 * @access  Private
 */
const getDashboard = async (req, res, next) => {
    try {
        const userId = req.user._id;

        // 1. Auctions created by the user
        const myAuctions = await Auction.find({ seller: userId })
            .populate('highestBidder', 'name')
            .sort({ createdAt: -1 });

        // 2. Auctions the user has bid on (unique auctions)
        const myBids = await Bid.find({ bidder: userId }).distinct('auctionId');
        const biddingOn = await Auction.find({
            _id: { $in: myBids },
            status: 'active',
        })
            .populate('seller', 'name')
            .populate('highestBidder', 'name')
            .sort({ endTime: 1 });

        // 3. Auctions won by the user
        const auctionsWon = await Auction.find({
            highestBidder: userId,
            status: 'completed',
        })
            .populate('seller', 'name')
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                myAuctions,
                biddingOn,
                auctionsWon,
                stats: {
                    totalCreated: myAuctions.length,
                    activeBids: biddingOn.length,
                    totalWon: auctionsWon.length,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getDashboard };
