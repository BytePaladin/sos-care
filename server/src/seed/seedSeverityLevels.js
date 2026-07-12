// ============================================================
// src/seed/seedSeverityLevels.js
// Kaj: SEVERITY_LEVEL collection e 3 ta row bosano (GREEN/YELLOW/RED).
// Run:  npm run seed
//
// Keno seed script? Notun developer (Sabit/Imtiaz) clone korle
// DB khali thakbe. Ei script chalale shathe shathe kaj korbe.
// ============================================================

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import SeverityLevel from '../models/SeverityLevel.js';

// priorityOrder 1 = HIGHEST -> dashboard e RED shobar age
const LEVELS = [
  {
    levelCode: 'RED',
    levelName: 'Urgent',
    priorityOrder: 1,
    description: 'Potentially life-threatening. Requires immediate clinical review.',
    colorHex: '#dc2626',
  },
  {
    levelCode: 'YELLOW',
    levelName: 'Needs Review',
    priorityOrder: 2,
    description: 'Non-specific but clinically significant. Should be reviewed soon.',
    colorHex: '#f59e0b',
  },
  {
    levelCode: 'GREEN',
    levelName: 'Routine',
    priorityOrder: 3,
    description: 'Administrative or routine query. Normal response cycle.',
    colorHex: '#16a34a',
  },
];

const seed = async () => {
  await connectDB();

  console.log('[seed] Seeding severity levels...');

  for (const level of LEVELS) {
    // upsert: thakle update, na thakle insert.
    // Eita IDEMPOTENT — 10 bar chalaleo duplicate hobe na.
    await SeverityLevel.findOneAndUpdate({ levelCode: level.levelCode }, level, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    console.log(`  ✔ ${level.levelCode.padEnd(6)} (priority ${level.priorityOrder}) — ${level.levelName}`);
  }

  const count = await SeverityLevel.countDocuments();
  console.log(`[seed] Done. SeverityLevel collection now has ${count} documents.`);

  await disconnectDB();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error(`[seed] FAILED -> ${err.message}`);
  await mongoose.connection.close();
  process.exit(1);
});
