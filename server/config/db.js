import mongoose from 'mongoose';
import dns from 'dns';

// Fix Windows DNS querySrv ECONNREFUSED issue for MongoDB Atlas
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // fallback if restricted
}

let memoryServer = null;

/**
 * MONGODB_URI না দিলে development-এ একটি in-memory MongoDB চালু করা হয়,
 * যাতে demo চালাতে আলাদা করে mongod বা Atlas account লাগে না।
 * Data প্রতিবার restart-এ মুছে যাবে — তাই `npm run seed` আবার চালাতে হবে।
 */
const startInMemoryMongo = async () => {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  return `${memoryServer.getUri()}sos-care`;
};

export const connectDB = async () => {
  try {
    let connStr = process.env.MONGODB_URI;

    if (!connStr) {
      console.log('[MongoDB] MONGODB_URI not set — starting in-memory MongoDB (first run downloads a binary)...');
      connStr = await startInMemoryMongo();
    }

    const conn = await mongoose.connect(connStr);
    console.log(`[MongoDB] Connected: ${conn.connection.host} / ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB Error] ${error.message}`);
    process.exit(1);
  }
};

// in-memory server চালু থাকলে process বন্ধ হওয়ার সময় সেটিও বন্ধ করা দরকার
export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};
