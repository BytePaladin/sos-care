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

export const connectDB = async () => {
  if (cached.conn) {
    console.log('[MongoDB] Using cached connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sos-care';
    cached.promise = mongoose.connect(connStr).then((mongooseInstance) => {
      console.log(`[MongoDB] Connected: ${mongooseInstance.connection.host} / ${mongooseInstance.connection.name}`);
      return mongooseInstance;
    });
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
