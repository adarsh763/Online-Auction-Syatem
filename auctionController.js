const { validationResult } = require('express-validator');
const Auction = require('../models/Auction');

/**
 * @route   POST /api/auction/create
 * @desc    Create a new auction
 * @access  Private
 */
const createAuction = async (req, res, next) => {
    try {
        // 1. Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('Auction validation failed:', errors.array());
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { title, description, startingPrice, endTime } = req.body;

        // Handle uploaded image path
        let imagePath = '';
        if (req.file) {
            imagePath = `/uploads/${req.file.filename}`;
        }

        // 2. Create auction with the authenticated user as seller
        const auction = await Auction.create({
            title,
            description,
            startingPrice: Number(startingPrice),
            currentHighestBid: Number(startingPrice),
            seller: req.user._id,
            endTime,
            image: imagePath,
            status: 'active',
        });

        // 3. Populate seller details for the real-time broadcast
        const populatedAuction = await Auction.findById(auction._id)
            .populate('seller', 'name email');

        // 4. Emit the new auction to all connected clients globally
        const io = req.app.get('io');
        if (io) {
            io.emit('newAuction', populatedAuction);
        }

        res.status(201).json({
            success: true,
            message: 'Auction created successfully.',
            data: auction,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/auctions
 * @desc    Get all auctions with optional filters and pagination
 * @access  Public
 */
const getAllAuctions = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 12 } = req.query;

        // Build filter
        const filter = {};
        if (status && ['pending', 'active', 'completed'].includes(status)) {
            filter.status = status;
        }

        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
        const skip = (pageNum - 1) * limitNum;

        const [auctions, total] = await Promise.all([
            Auction.find(filter)
                .populate('seller', 'name email')
                .populate('highestBidder', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Auction.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            data: auctions,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @route   GET /api/auction/:id
 * @desc    Get a single auction by ID
 * @access  Public
 */
const getAuctionById = async (req, res, next) => {
    try {
        const auction = await Auction.findById(req.params.id)
            .populate('seller', 'name email')
            .populate('highestBidder', 'name');

        if (!auction) {
            return res
                .status(404)
                .json({ success: false, message: 'Auction not found.' });
        }

        res.status(200).json({
            success: true,
            data: auction,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { createAuction, getAllAuctions, getAuctionById };
