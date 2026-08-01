import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { getHospitalAnalytics } from './controllers/adminController.js';

dotenv.config({ path: '../.env.local' });

async function testLiveDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to LIVE DB');
    
    const res = {
      json: (data) => console.log('SUCCESS:', JSON.stringify(data, null, 2)),
      status: (code) => ({
        json: (data) => console.log(`ERROR ${code}:`, data)
      })
    };
    
    await getHospitalAnalytics({}, res);
    
    process.exit(0);
  } catch (err) {
    console.error('CRASH:', err);
    process.exit(1);
  }
}

testLiveDB();
