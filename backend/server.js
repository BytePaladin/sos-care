const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('MongoDB connected successfully for S.O.S.');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// Basic Route for testing
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'S.O.S. Backend is running', message: 'Green' });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
