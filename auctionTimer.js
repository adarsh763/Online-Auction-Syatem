const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

const TIMER_INTERVAL_MS = 2_000; // Check every 2 seconds for fast closure

/**
 * Periodically checks for expired auctions and closes them.
 * Emits 'auctionEnded' to the corresponding Socket room.
 * @param {import('socket.io').Server} io
 */
const startAuctionTimer = (io) => {
    // 1. Regular check to CLOSE expired auctions (runs every 2s)
    setInterval(async () => {
        try {
            const now = new Date();
            const expiredAuctions = await Auction.find({
                status: 'active',
                endTime: { $lte: now },
            }).populate('highestBidder', 'name email');

            for (const auction of expiredAuctions) {
                auction.status = 'completed';
                await auction.save();

                const totalBids = await Bid.countDocuments({ auctionId: auction._id });
                const winner = auction.highestBidder
                    ? { id: auction.highestBidder._id, name: auction.highestBidder.name, email: auction.highestBidder.email }
                    : null;

                io.to(auction._id.toString()).emit('auctionEnded', {
                    auctionId: auction._id,
                    title: auction.title,
                    finalPrice: auction.currentHighestBid,
                    startingPrice: auction.startingPrice,
                    winner,
                    totalBids,
                    message: winner
                        ? `🏆 Auction won by ${winner.name} for $${auction.currentHighestBid.toLocaleString()}!`
                        : 'Auction ended with no bids.',
                });

                console.log(`⏰ Auction closed: "${auction.title}"`);
            }
        } catch (err) {
            console.error('Auction closure error:', err.message);
        }
    }, TIMER_INTERVAL_MS);

    // 2. Broadcast remaining time for SYNC (runs every 1s)
    setInterval(async () => {
        try {
            const activeAuctions = await Auction.find({ status: 'active' });
            for (const auction of activeAuctions) {
                const now = new Date();
                const diff = new Date(auction.endTime) - now;
                
                io.to(auction._id.toString()).emit('timerSync', {
                    auctionId: auction._id,
                    endTime: auction.endTime,
                    remainingMs: Math.max(0, diff),
                });
            }
        } catch (err) {
            // Silently fail for broadcast
        }
    }, 1000);

    console.log(`🕐 Auction timer & sync started (closure every ${TIMER_INTERVAL_MS / 1000}s, sync every 1s)`);
};

module.exports = startAuctionTimer;
