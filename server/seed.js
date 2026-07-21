import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Fix Windows DNS querySrv ECONNREFUSED issue for MongoDB Atlas
dns.setDefaultResultOrder('ipv4first');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {
  // fallback if restricted
}

import { User } from './models/User.js';
import { PatientTriage } from './models/PatientTriage.js';
import { ChatSession } from './models/ChatSession.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env.local') });
dotenv.config();

const seedDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sos-care';
    console.log(`[Seed] Connecting to ${connStr}...`);
    await mongoose.connect(connStr);

    console.log('[Seed] Clearing existing collections...');
    await User.deleteMany({});
    await PatientTriage.deleteMany({});
    await ChatSession.deleteMany({});

    console.log('[Seed] Inserting users...');
    const patientUser = await User.create({
      name: 'John Doe',
      phone: '01700000000',
      password: 'password123',
      role: 'patient',
    });

    const staff1 = await User.create({
      name: 'Dr. Nusrat Jahan',
      phone: '01800000000',
      password: 'password123',
      role: 'staff',
      staffRole: 'Chief Nephrologist',
      telegramChatId: process.env.VITE_TELEGRAM_CHAT_ID || '6116969946',
      telegramOptIn: true,
    });

    const staff2 = await User.create({
      name: 'Dr. Tanvir Ahmed',
      phone: '01900000000',
      password: 'password123',
      role: 'staff',
      staffRole: 'Resident Physician',
      telegramChatId: '',
      telegramOptIn: false,
    });

    console.log('[Seed] Inserting triage records & chat logs...');

    // Patient 1: Red Alert
    const triage1 = await PatientTriage.create({
      patientName: 'Rahima Begum',
      patientPhone: '01712345678',
      userId: null,
      category: 'red',
      aiAnalysis: {
        symptomSummary: 'Severe bilateral edema, dark foamy urine, sudden weight gain',
        symptomTags: ['Edema', 'Proteinuria', 'Hypertension'],
        confidenceScore: 0.94,
        riskFactors: ['Chronic Kidney Disease History'],
      },
      reviewStatus: 'pending',
      notes: [
        {
          author: 'System',
          text: 'AI Screening classified patient as Red Alert: Foamy urine + severe bilateral edema + dark color.',
          timestamp: new Date(Date.now() - 3600000 * 2),
        },
      ],
      screenedAt: new Date(Date.now() - 3600000 * 2),
    });

    await ChatSession.create({
      triageId: triage1._id,
      title: 'Initial Nephrology Screening',
      status: 'flagged_red',
      messages: [
        { sender: 'user', text: 'Hi, my legs have been swelling really badly for 3 days and my urine is dark and foamy.', timestamp: new Date(Date.now() - 3600000 * 2) },
        { sender: 'bot', text: 'Thank you Rahima. Have you noticed any facial puffiness, shortness of breath, or headache?', timestamp: new Date(Date.now() - 3600000 * 2 + 10000) },
        { sender: 'user', text: 'Yes, around my eyes when I wake up, and feeling breathless when lying down.', timestamp: new Date(Date.now() - 3600000 * 2 + 20000) },
        { sender: 'bot', text: '🚨 Red Alert triggered: High risk of Acute Nephritic Syndrome / Renal Fluid Retention. Please proceed to the ER or wait for emergency contact.', timestamp: new Date(Date.now() - 3600000 * 2 + 30000) },
      ],
    });

    // Patient 2: Yellow Category (Forwarded)
    const triage2 = await PatientTriage.create({
      patientName: 'Tariqul Islam',
      patientPhone: '01898765432',
      userId: null,
      category: 'yellow',
      aiAnalysis: {
        symptomSummary: 'Mild ankle swelling and fatigue following recent medication change',
        symptomTags: ['Ankle Swelling', 'Fatigue'],
        confidenceScore: 0.72,
      },
      reviewStatus: 'needs_review',
      forwardedTo: staff2._id,
      reviewedBy: staff1._id,
      reviewedAt: new Date(Date.now() - 3600000 * 5),
      notes: [
        {
          author: `${staff1.name} (${staff1.staffRole})`,
          authorId: staff1._id,
          text: 'Forwarded patient to Dr. Tanvir Ahmed for medication review.',
          timestamp: new Date(Date.now() - 3600000 * 5),
        },
      ],
      screenedAt: new Date(Date.now() - 3600000 * 12),
    });

    await ChatSession.create({
      triageId: triage2._id,
      title: 'Symptom Follow-up',
      status: 'active',
      messages: [
        { sender: 'user', text: 'I started new blood pressure meds last week and now my ankles look slightly puffy.', timestamp: new Date(Date.now() - 3600000 * 12) },
        { sender: 'bot', text: 'Moderate triage (Yellow): Calcium channel blockers can cause mild edema. Scheduled for practitioner review.', timestamp: new Date(Date.now() - 3600000 * 12 + 10000) },
      ],
    });

    // Patient 3: Green Category (Contacted)
    const triage3 = await PatientTriage.create({
      patientName: 'Nusrat Parveen',
      patientPhone: '01655443322',
      userId: null,
      category: 'green',
      aiAnalysis: {
        symptomSummary: 'Routine checkup query, normal hydration and urine output',
        symptomTags: ['Routine Query'],
        confidenceScore: 0.98,
      },
      reviewStatus: 'contacted',
      reviewComment: 'Contacted patient via phone, reassured that symptoms are normal.',
      reviewedBy: staff1._id,
      reviewedAt: new Date(Date.now() - 3600000 * 24),
      notes: [
        {
          author: `${staff1.name} (${staff1.staffRole})`,
          authorId: staff1._id,
          text: 'Contacted patient via phone, reassured that symptoms are normal.',
          timestamp: new Date(Date.now() - 3600000 * 24),
        },
      ],
      screenedAt: new Date(Date.now() - 3600000 * 48),
    });

    await ChatSession.create({
      triageId: triage3._id,
      title: 'Routine Inquiry',
      status: 'completed',
      messages: [
        { sender: 'user', text: 'How much water should I drink daily to keep my kidneys healthy?', timestamp: new Date(Date.now() - 3600000 * 48) },
        { sender: 'bot', text: 'Low triage (Green): General advice provided. 2-2.5 Liters daily is recommended for average adults.', timestamp: new Date(Date.now() - 3600000 * 48 + 10000) },
      ],
    });

    console.log('[Seed] Success! Database seeded cleanly.');
    process.exit(0);
  } catch (error) {
    console.error(`[Seed Error] ${error.message}`);
    process.exit(1);
  }
};

seedDB();
