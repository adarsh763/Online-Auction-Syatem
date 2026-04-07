// ── Load environment variables FIRST (before any other requires) ──
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const initSocketHandlers = require('./socket/socketHandler');
const startAuctionTimer = require('./socket/auctionTimer');

// ── Import routes ──
const authRoutes = require('./routes/authRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const bidRoutes = require('./routes/bidRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
// ── Initialise Express ──
const app = express();

// ── Create HTTP server and attach Socket.io ──
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

// ── Make io accessible in controllers via req.io ──
app.set('io', io);

// ── Global middleware ──
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Configure View Engine (EJS) ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Static files serving moved below specific routes to prevent hijacking

// ── Serve uploaded images ──
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Temporary Debug Route ──
const multer = require('multer');
app.post('/api/test-upload', multer().any(), (req, res) => {
    res.json({
        headers: req.headers,
        body: req.body,
        files: req.files
    });
});

// ── Health check (available at /api/health) ──
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Online Auction API is running.' });
});

// ── Legacy Redirects (Prevents 404 on old bookmarks) ──
app.get('/pages/auctions.html', (req, res) => res.redirect('/auctions'));
app.get('/pages/dashboard.html', (req, res) => res.redirect('/dashboard'));
app.get('/pages/login.html', (req, res) => res.redirect('/login'));
app.get('/pages/register.html', (req, res) => res.redirect('/register'));
app.get('/pages/create-auction.html', (req, res) => res.redirect('/create-auction'));
app.get('/index.html', (req, res) => res.redirect('/'));

// ── Static Page Routes ──
app.get('/', (req, res) => {
    res.render('index', { title: 'Online Auction — Discover & Bid on Premium Items' });
});

app.get('/auctions', (req, res) => {
    res.render('auctions', { title: 'Browse Auctions — Online Auction' });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Login — Online Auction' });
});

app.get('/register', (req, res) => {
    res.render('register', { title: 'Register — Online Auction' });
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard', { title: 'Your Dashboard — Online Auction' });
});

app.get('/create-auction', (req, res) => {
    res.render('create-auction', { title: 'Create Auction — Online Auction' });
});

app.get('/auction-room/:id', (req, res) => {
    res.render('auction-room', { title: 'Live Auction Room — Online Auction', auctionId: req.params.id });
});

// ── API routes ──
app.use('/api', authRoutes);
app.use('/api', auctionRoutes);
app.use('/api', bidRoutes);
app.use('/api', dashboardRoutes);
// ── Serve frontend static files (moved from top) ──
app.use(express.static(path.join(__dirname, '../../frontend')));

// ── 404 handler ──
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global error handler (must be last) ──
app.use(errorHandler);

// ── Start server ──
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    // ── Auto-seed mock auctions ──
    const mongoose = require('mongoose');
    const Auction = require('./models/Auction');
    const User = require('./models/User');
    
    // 1. Ensure a Guest User exists for seeding
    let guestUser = await User.findOne({ email: 'guest@example.com' });
    if (!guestUser) {
        guestUser = await User.create({
            name: 'Guest Player',
            email: 'guest@example.com',
            password: 'defaultPassword123!',
            isVerified: true
        });
    }

    // 2. Clear existing mock data
    await Auction.deleteMany({});
    console.log('Cleared existing database for fresh seed.');
    
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    // 3. Insert mock auctions with valid seller ID
    await Auction.insertMany([
        {
            title: 'Vintage 1960s Rolex Submariner',
            description: 'A beautifully preserved 1960s Rolex Submariner. Original dial and hands with matching patina. Fully serviced.',
            startingPrice: 15000,
            currentHighestBid: 15000,
            endTime: tomorrow,
            seller: guestUser._id,
            status: 'active',
            image: '/images/items/rolex.png'
        },
        {
            title: 'Original Oil Painting - Abstract Sunset',
            description: 'A stunning original oil painting measuring 40x60 inches. Vibrant colors depicting a sunset over the ocean. Signed by the artist.',
            startingPrice: 850,
            currentHighestBid: 850,
            endTime: new Date(now.getTime() + 5 * 60 * 1000), // Ends in 5 minutes
            seller: guestUser._id,
            status: 'active',
            image: '/images/items/painting.png'
        },
        {
            title: 'Roman Silver Denarius - 1st Century',
            description: 'Authentic Roman silver coin (Denarius) from the 1st century AD. Excellent condition with clear details on both obverse and reverse.',
            startingPrice: 300,
            currentHighestBid: 300,
            endTime: nextWeek,
            seller: guestUser._id,
            status: 'active',
            image: '/images/items/coin.png'
        },
        {
            title: 'First Edition - The Great Gatsby',
            description: 'A rare first edition, first printing of F. Scott Fitzgerald\'s The Great Gatsby (1925). Original dust jacket with minor wear.',
            startingPrice: 25000,
            currentHighestBid: 25000,
            endTime: new Date(now.getTime() + 12 * 60 * 60 * 1000), 
            seller: guestUser._id,
            status: 'active',
            image: '/images/items/book.png'
        }
    ]);
    console.log('Mock auctions seeded successfully.');

    // Initialise Socket.io event handlers
    initSocketHandlers(io);

    // Start the auction auto-close timer
    startAuctionTimer(io);

    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
};

startServer();

module.exports = { app, io };
