import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';
import { PatientTriage } from './models/PatientTriage.js';
import { ChatSession } from './models/ChatSession.js';
import { StaffAction } from './models/StaffAction.js';

dotenv.config({ path: '../.env.local' });

async function testAnalytics() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalScreenings = await PatientTriage.countDocuments({});
    console.log({ totalPatients, totalScreenings });
    process.exit(0);
  } catch (err) {
    console.error('Crash!', err);
    process.exit(1);
  }
}
testAnalytics();
