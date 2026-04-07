const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;

    // Try connecting to the configured URI first
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      return;
    } catch (err) {
      console.log('Local MongoDB not available, starting in-memory server...');
    }

    // Fallback: start an in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    uri = mongoServer.getUri();

    await mongoose.connect(uri);
    console.log(`MongoDB In-Memory Connected: ${uri}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
