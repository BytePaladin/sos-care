// ============================================================
// src/config/db.js
// Kaj: MongoDB Atlas (free tier M0) er sathe Mongoose connection.
// Keno alada file: connection logic ek jaygay thakle test/seed
//      script gulo o eita reuse korte parbe.
// ============================================================

import mongoose from 'mongoose';
import env, { isDev } from './env.js';

// Mongoose 7+ e strictQuery default false — explicit kore dilam
// jate unknown field diye query korle silently ignore na hoy.
mongoose.set('strictQuery', true);

// Development e prottekta MongoDB query terminal e print hobe (debugging er jonno)
if (isDev) {
  mongoose.set('debug', false); // true kore dile shob query dekhbe — noisy, tai off
}

/**
 * MongoDB Atlas e connect kore.
 * Fail korle process exit kore dey — kar-on DB chhara API meaningless.
 */
export const connectDB = async () => {
  try {
    // connect() ekta Promise return kore — await kore wait kori
    const conn = await mongoose.connect(env.MONGO_URI, {
      // 10 second er moddhe server na paile timeout — default 30s onek beshi
      serverSelectionTimeoutMS: 10000,
      // Connection pool: free tier M0 te beshi connection dile throttle kore
      maxPoolSize: 10,
    });

    // Kon host e connect holo seta log kori (Atlas cluster naam dekha jabe)
    console.log(`[db] MongoDB connected -> ${conn.connection.host}`);
    console.log(`[db] Database name    -> ${conn.connection.name}`);

    return conn;
  } catch (error) {
    // Connection string bhul, IP whitelist na kora, password bhul — shob ekhane ashe
    console.error(`[db] FATAL: MongoDB connection failed -> ${error.message}`);
    process.exit(1);
  }
};

// Connection chole gele (network drop) log kori — silent failure jate na hoy
mongoose.connection.on('disconnected', () => {
  console.warn('[db] MongoDB disconnected');
});

// Runtime e kono error hole (query fail, auth expire) seta dhori
mongoose.connection.on('error', (err) => {
  console.error(`[db] MongoDB runtime error -> ${err.message}`);
});

/**
 * Ctrl+C / SIGTERM pele DB connection bhalo bhabe bondho kore exit kore.
 * Eita na korle Atlas e "hanging connection" jome thake (free tier e limit ache).
 */
export const disconnectDB = async () => {
  await mongoose.connection.close();
  console.log('[db] MongoDB connection closed gracefully');
};

export default connectDB;
