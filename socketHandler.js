const User = require('../models/User');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');

const BID_COUNTDOWN_MS = 10 * 1000; // 10 seconds after each bid

/**
 * Initialise all Socket.io event handlers.
 * @param {import('socket.io').Server} io
 */
const initSocketHandlers = (io) => {
    // ── Auth Bypass: Use Guest User for all socket connections ──
    io.use(async (socket, next) => {
        try {
            let guestUser = await User.findOne({ email: 'guest@example.com' });
            if (!guestUser) {
                guestUser = await User.create({
                    name: 'Guest Player',
                    email: 'guest@example.com',
                    password: 'defaultPassword123!',
                    isVerified: true,
                });
            }

            socket.user = { id: guestUser._id.toString(), name: guestUser.name, email: guestUser.email };
            next();
        } catch (err) {
            console.error('Socket Auth Bypass Error:', err);
            next(new Error('Failed to provide guest access'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`⚡ Socket connected: ${socket.user.name} (${socket.id})`);

        // ── Join an auction room ──
        socket.on('joinAuction', async (auctionId) => {
            try {
                const auction = await Auction.findById(auctionId)
                    .populate('seller', 'name')
                    .populate('highestBidder', 'name');

                if (!auction) {
                    return socket.emit('error', { message: 'Auction not found.' });
                }

                socket.join(auctionId);
                console.log(`${socket.user.name} joined auction room: ${auctionId}`);

                // Send current auction state to the joining client
                socket.emit('auctionState', {
                    auction: {
                        id: auction._id,
                        title: auction.title,
                        description: auction.description,
                        startingPrice: auction.startingPrice,
                        currentHighestBid: auction.currentHighestBid,
                        highestBidder: auction.highestBidder,
                        seller: auction.seller,
                        endTime: auction.endTime,
                        image: auction.image,
                        status: auction.status,
                    },
                });

                // Fetch and send bid history
                const bids = await Bid.find({ auctionId })
                    .populate('bidder', 'name')
                    .sort({ timestamp: -1 })
                    .limit(50);

                socket.emit('bidHistory', { bids });

                // Get total bid count for this auction
                const totalBids = await Bid.countDocuments({ auctionId });

                // Send online count to the joining user AND notify others
                const onlineCount = io.sockets.adapter.rooms.get(auctionId)?.size || 1;
                socket.emit('userJoined', { userName: socket.user.name, onlineCount, totalBids });
                socket.to(auctionId).emit('userJoined', {
                    userName: socket.user.name,
                    onlineCount,
                });
            } catch (err) {
                console.error('Join auction error:', err.message);
                socket.emit('error', { message: 'Failed to join auction room.' });
            }
        });

        // ── Leave an auction room ──
        socket.on('leaveAuction', (auctionId) => {
            socket.leave(auctionId);
            console.log(`${socket.user.name} left auction room: ${auctionId}`);

            socket.to(auctionId).emit('userLeft', {
                userName: socket.user.name,
                onlineCount: (io.sockets.adapter.rooms.get(auctionId)?.size || 1) - 1,
            });
        });

        // ── Place a bid via Socket ──
        // "Going once, going twice, SOLD!" mechanic:
        // Every bid resets the auction countdown to 10 seconds.
        // If no one bids within 10 seconds, the auction closes.
        socket.on('placeBid', async ({ auctionId, amount }) => {
            try {
                const bidAmount = parseFloat(amount);
                if (!auctionId || isNaN(bidAmount) || bidAmount <= 0) {
                    return socket.emit('bidError', { message: 'Invalid bid data.' });
                }

                // 1. Find the auction
                const auction = await Auction.findById(auctionId);
                if (!auction) {
                    return socket.emit('bidError', { message: 'Auction not found.' });
                }

                // 2. Check auction is active
                if (auction.status !== 'active') {
                    return socket.emit('bidError', { message: 'This auction is no longer active.' });
                }

                if (new Date() > new Date(auction.endTime)) {
                    return socket.emit('bidError', { message: 'This auction has ended.' });
                }

                // 3. Validate bid amount — must be strictly higher than current highest
                if (bidAmount <= auction.currentHighestBid) {
                    return socket.emit('bidError', {
                        message: `Bid must be higher than $${auction.currentHighestBid.toLocaleString()}. Try again.`,
                    });
                }

                // 4. ── 10-SECOND COUNTDOWN ──
                // Every bid resets the auction to close in 10 seconds
                const newEndTime = new Date(Date.now() + BID_COUNTDOWN_MS);

                // 5. Atomic update — prevents race conditions
                const updatedAuction = await Auction.findOneAndUpdate(
                    { _id: auctionId, currentHighestBid: { $lt: bidAmount } },
                    {
                        currentHighestBid: bidAmount,
                        highestBidder: socket.user.id,
                        endTime: newEndTime,
                    },
                    { new: true }
                );

                if (!updatedAuction) {
                    return socket.emit('bidError', {
                        message: 'Someone placed a higher bid just before you. Try again.',
                    });
                }

                // 6. Save bid record
                const bid = await Bid.create({
                    auctionId,
                    bidder: socket.user.id,
                    amount: bidAmount,
                });

                // 7. Get total bid count
                const totalBids = await Bid.countDocuments({ auctionId });

                // 8. Broadcast bid update to ALL users in the room
                const bidUpdateData = {
                    bid: {
                        id: bid._id,
                        amount: bid.amount,
                        bidder: { id: socket.user.id, name: socket.user.name },
                        timestamp: bid.timestamp,
                    },
                    currentHighestBid: updatedAuction.currentHighestBid,
                    highestBidder: { id: socket.user.id, name: socket.user.name },
                    totalBids,
                    bidderId: socket.user.id,
                };

                // Emit both for backward compatibility and internal sync
                io.to(auctionId).emit('bidUpdate', bidUpdateData);
                io.to(auctionId).emit('newBid', bidUpdateData);

                // 9. Broadcast countdown reset — "Going once, going twice..."
                io.to(auctionId).emit('countdownReset', {
                    newEndTime: newEndTime.toISOString(),
                    secondsLeft: 10,
                    message: `⏱ 10 seconds! Going once, going twice...`,
                    bidderName: socket.user.name,
                    bidAmount,
                });

                console.log(`💰 ${socket.user.name} bid $${bidAmount} → auction closes in 10s (Total: ${totalBids} bids)`);
            } catch (err) {
                console.error('Bid error:', err.message);
                socket.emit('bidError', { message: 'Failed to place bid. Please try again.' });
            }
        });

        // ── Disconnect ──
        socket.on('disconnect', () => {
            console.log(`🔌 Socket disconnected: ${socket.user.name} (${socket.id})`);
        });
    });
};

module.exports = initSocketHandlers;
