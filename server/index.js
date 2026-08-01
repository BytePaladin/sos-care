import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => console.error('MongoDB connection error:', err));
} else {
  console.warn('MONGODB_URI is missing from .env.local');
}

// ---------------------------------------------------------
// TEMPORARY RANDOM TRIAGE SYSTEM FOR PATIENT DASHBOARD
// ---------------------------------------------------------
app.get('/api/triage', (req, res) => {
  // Randomly generate a triage severity for temporary use
  const severities = ['Green', 'Yellow', 'Red', 'Black'];
  const messages = {
    Green: 'Low priority. Please wait for standard care.',
    Yellow: 'Medium priority. Medical staff will see you soon.',
    Red: 'High priority! Immediate medical attention required.',
    Black: 'Critical priority.'
  };

  const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
  const randomMessage = messages[randomSeverity];

  res.json({
    success: true,
    data: {
      patientId: `PAT-${Math.floor(Math.random() * 10000)}`,
      severity: randomSeverity,
      message: randomMessage,
      timestamp: new Date().toISOString()
    }
  });
});

app.post('/api/triage', (req, res) => {
  // Mock endpoint to accept triage data and return a random result
  const severities = ['Green', 'Yellow', 'Red'];
  const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
  
  res.json({
    success: true,
    message: 'Triage data processed (Randomized for temporary use)',
    result: {
      severity: randomSeverity,
      recommendedAction: randomSeverity === 'Red' ? 'Immediate Care' : 'Wait in lobby'
    }
  });
});

// Basic Health Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'S.O.S. Backend is running fresh', db: mongoose.connection?.readyState === 1 ? 'connected' : 'disconnected' });
});

// ---------------------------------------------------------
// TEMPORARY MOCK LOGIN ENDPOINTS FOR TESTING
// ---------------------------------------------------------
app.post('/api/auth/login', (req, res) => {
  const { phone, password } = req.body;
  if (phone === '123' && password === '123') {
    return res.json({
      token: 'mock-patient-token-123',
      user: { id: 'patient1', name: 'Test Patient', phone: '123', role: 'patient' }
    });
  }
  return res.status(401).json({ message: 'Invalid credentials. Use 123 / 123 for testing.' });
});

app.post('/api/admin/login', (req, res) => {
  const { phone, password } = req.body;
  if (phone === 'admin' && password === 'admin') {
    return res.json({
      token: 'mock-admin-token-123',
      user: { id: 'admin1', name: 'Test Admin', phone: 'admin', role: 'admin' }
    });
  }
  return res.status(401).json({ message: 'Invalid credentials. Use admin / admin for testing.' });
});

// Serve Static Frontend (for live deployment testing)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start Server (only if not running in a serverless environment like Vercel)
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (Live Test Mode)`);
  });
}

export default app;
