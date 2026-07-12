// ============================================================
// src/server.js
// Kaj: ENTRY POINT. DB connect kore, tarpor port e listen kore.
//
// Order ta important: DB connect NA hole server start-i korbo na.
// Nahole request ashbe kintu DB nai -> weird error.
// ============================================================

import app from './app.js';
import env from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';

// ── STARTUP ──
const startServer = async () => {
  // 1) Age MongoDB Atlas e connect — fail korle process.exit(1) hobe
  await connectDB();

  // 2) Tarpor HTTP server chalu
  const server = app.listen(env.PORT, () => {
    console.log('');
    console.log('  ╔══════════════════════════════════════════════╗');
    console.log('  ║   S.O.S. — Symptom Optimized Screener API     ║');
    console.log('  ╚══════════════════════════════════════════════╝');
    console.log(`  Mode  : ${env.NODE_ENV}`);
    console.log(`  Port  : ${env.PORT}`);
    console.log(`  URL   : http://localhost:${env.PORT}/api/health`);
    console.log('');
  });

  // ── GRACEFUL SHUTDOWN ──
  // Ctrl+C (SIGINT) ba deploy platform er SIGTERM pele:
  //   1. Notun request nea bondho
  //   2. Cholte thaka request gulo shesh hote dey
  //   3. DB connection close
  //   4. Exit
  // Eita na korle Atlas free tier e connection jome thake.
  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received — shutting down gracefully...`);

    server.close(async () => {
      await disconnectDB();
      console.log('[server] Shutdown complete');
      process.exit(0);
    });

    // 10 second er moddhe close na hole force kill
    setTimeout(() => {
      console.error('[server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT')); // Ctrl+C
  process.on('SIGTERM', () => shutdown('SIGTERM')); // Render/Railway stop

  // ── UNHANDLED ERROR SAFETY NET ──
  // Kono Promise reject holo kintu keu .catch() kore nai
  process.on('unhandledRejection', (err) => {
    console.error(`[server] UNHANDLED REJECTION -> ${err.message}`);
    server.close(() => process.exit(1));
  });
};

startServer();
