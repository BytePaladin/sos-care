// ============================================================
// src/seed/seedStaff.js
// Kaj: Demo doctor/nurse/admin account banano — dashboard test korar jonno.
// Run:  npm run seed:staff
//
// WARNING: ei password gulo DEMO only. Production e NEVER.
// ============================================================

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import Staff from '../models/Staff.js';

const DEMO_STAFF = [
  {
    fullName: 'Dr. Ayesha Rahman',
    email: 'doctor@soscare.test',
    passwordHash: 'Doctor@1234', // pre-save hook hash kore dibe
    role: 'DOCTOR',
    phoneNumber: '01711111111',
    department: 'Nephrology',
  },
  {
    fullName: 'Nurse Karim Uddin',
    email: 'nurse@soscare.test',
    passwordHash: 'Nurse@1234',
    role: 'NURSE',
    phoneNumber: '01722222222',
    department: 'Nephrology',
  },
  {
    fullName: 'System Administrator',
    email: 'admin@soscare.test',
    passwordHash: 'Admin@1234',
    role: 'ADMIN',
    phoneNumber: '01733333333',
    department: 'IT',
  },
];

const seed = async () => {
  await connectDB();

  console.log('[seed] Seeding demo staff accounts...');

  for (const person of DEMO_STAFF) {
    const exists = await Staff.findOne({ email: person.email });

    if (exists) {
      console.log(`  · ${person.email} already exists — skipped`);
      continue;
    }

    // .create() use kori (findOneAndUpdate na) — karon upsert e
    // pre-save hook chole NA, tai password hash hobe na!
    await Staff.create(person);
    console.log(`  ✔ ${person.role.padEnd(6)} ${person.email}`);
  }

  console.log('');
  console.log('  Demo logins (POST /api/auth/staff/login):');
  console.log('    doctor@soscare.test / Doctor@1234');
  console.log('    nurse@soscare.test  / Nurse@1234');
  console.log('    admin@soscare.test  / Admin@1234');
  console.log('');

  await disconnectDB();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error(`[seed] FAILED -> ${err.message}`);
  await mongoose.connection.close();
  process.exit(1);
});
