import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from './models/User.js';

dotenv.config({ path: '../.env.local' });

async function fixAdminUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to LIVE DB');
    
    // Find the user and update their role to 'admin'
    const user = await User.findOneAndUpdate(
      { name: 'Dr. Rafiqul Islam' }, 
      { role: 'admin' }, 
      { new: true }
    );
    
    if (user) {
      console.log('Successfully upgraded user to admin in DB:', user.name);
    } else {
      console.log('Could not find user Dr. Rafiqul Islam');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('CRASH:', err);
    process.exit(1);
  }
}

fixAdminUser();
