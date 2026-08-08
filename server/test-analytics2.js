import mongoose from 'mongoose';
import { getHospitalAnalytics } from './controllers/adminController.js';
import { User } from './models/User.js';

async function test() {
  try {
    // connect to local DB
    await mongoose.connect('mongodb://127.0.0.1:27017/sos-care');
    console.log('Connected to local DB');
    
    // create mock res object
    const res = {
      json: (data) => {
        console.log('SUCCESS:', JSON.stringify(data, null, 2));
      },
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
test();
