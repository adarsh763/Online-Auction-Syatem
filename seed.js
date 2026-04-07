const mongoose = require('mongoose');
const Auction = require('./src/models/Auction');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online-auction')
  .then(async () => {
    console.log('Connected to DB. Clearing old auctions...');
    await Auction.deleteMany({});
    
    console.log('Creating new active auctions...');
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const auctions = [
      {
        title: 'Vintage 1960s Rolex Submariner',
        description: 'A beautifully preserved 1960s Rolex Submariner. Original dial and hands with matching patina. Fully serviced.',
        startingPrice: 15000,
        currentBid: 15000,
        endTime: tomorrow,
        seller: new mongoose.Types.ObjectId(), // Auto-generate valid ObjectId
        sellerName: 'Horology Masters',
        status: 'active',
        images: ['https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&q=80&w=800']
      },
      {
        title: 'Original Oil Painting - Abstract Sunset',
        description: 'A stunning original oil painting measuring 40x60 inches. Vibrant colors depicting a sunset over the ocean. Signed by the artist.',
        startingPrice: 850,
        currentBid: 1200,
        endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000), // Ends in 2 hours
        seller: new mongoose.Types.ObjectId(),
        sellerName: 'Gallery 42',
        status: 'active',
        images: ['https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&q=80&w=800']
      },
      {
        title: 'Roman Silver Denarius - 1st Century',
        description: 'Authentic Roman silver coin (Denarius) from the 1st century AD. Excellent condition with clear details on both obverse and reverse.',
        startingPrice: 300,
        currentBid: 450,
        endTime: nextWeek,
        seller: new mongoose.Types.ObjectId(),
        sellerName: 'Antiquity Coins',
        status: 'active',
        images: ['https://images.unsplash.com/photo-1621508654686-809f23efdabc?auto=format&fit=crop&q=80&w=800']
      },
      {
        title: 'First Edition - The Great Gatsby',
        description: 'A rare first edition, first printing of F. Scott Fitzgerald\'s The Great Gatsby (1925). Original dust jacket with minor wear.',
        startingPrice: 25000,
        currentBid: 32000,
        endTime: new Date(now.getTime() + 12 * 60 * 60 * 1000), // Ends in 12 hours
        seller: new mongoose.Types.ObjectId(),
        sellerName: 'Rare Books Archive',
        status: 'active',
        images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800']
      }
    ];

    await Auction.insertMany(auctions);
    console.log('Successfully seeded 4 active auctions.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error seeding data:', err);
    process.exit(1);
  });
