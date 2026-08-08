import mongoose from 'mongoose';
import dns from 'dns';

// Fix Windows DNS querySrv ECONNREFUSED issue for MongoDB Atlas
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // fallback if restricted
}

// Global is used here to maintain a cached connection across hot reloads
// in development and serverless function executions in production.
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

let memoryServer = null;

/**
 * If MONGODB_URI is not set, start an in-memory MongoDB so the stack can be run
 * for a demo without installing mongod or configuring an Atlas account.
 * The data is discarded on every restart, so it is re-seeded on startup.
 * When MONGODB_URI *is* set (Atlas / deployment) this path is never taken.
 */
const startInMemoryMongo = async () => {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  return `${memoryServer.getUri()}sos-care`;
};

/** True when no external MongoDB was configured — used to decide auto-seeding. */
export const isUsingInMemoryMongo = () => memoryServer !== null;

export const connectDB = async () => {
  if (cached.conn) {
    console.log('[MongoDB] Using cached connection');
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      let connStr = process.env.MONGODB_URI;

      if (!connStr) {
        console.log('[MongoDB] MONGODB_URI not set — starting in-memory MongoDB (first run downloads a binary)...');
        connStr = await startInMemoryMongo();
      }

      const mongooseInstance = await mongoose.connect(connStr);
      console.log(`[MongoDB] Connected: ${mongooseInstance.connection.host} / ${mongooseInstance.connection.name}`);
      return mongooseInstance;
    })();
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    console.error(`[MongoDB Error] ${error.message}`);
    process.exit(1);
  }

  return cached.conn;
};

// in-memory server চালু থাকলে process বন্ধ হওয়ার সময় সেটিও বন্ধ করা দরকার
export const disconnectDB = async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
};
