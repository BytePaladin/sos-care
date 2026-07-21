import { ChatSession } from '../models/ChatSession.js';
import { PatientTriage } from '../models/PatientTriage.js';

export const createChatSession = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const patientName = req.user ? req.user.name : (req.body.patientName || 'Anonymous Patient');
    const patientPhone = req.user ? req.user.phone : (req.body.patientPhone || 'N/A');

    const triage = await PatientTriage.create({
      patientName,
      patientPhone,
      userId,
      category: 'green',
      reviewStatus: 'pending',
    });

    const session = await ChatSession.create({
      triageId: triage._id,
      userId,
      title: 'Symptom Screening Session',
      status: 'active',
      messages: [
        {
          sender: 'bot',
          text: 'Hello! I am your S.O.S. Care Symptom Screener assistant. How can I help you today? Please describe your symptoms.',
          timestamp: new Date(),
        },
      ],
    });

    res.status(201).json({
      sessionId: session._id,
      triageId: triage._id,
      messages: session.messages,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message text is required' });
    }

    const session = await ChatSession.findById(id);
    if (!session) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    const userMsg = {
      sender: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    // Dynamic Triage Category Evaluation
    const categories = ['red', 'yellow', 'green'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];

    let botReplyText = '';
    if (randomCategory === 'red') {
      botReplyText = '🚨 URGENT RED ALERT: Your symptoms indicate a high-risk medical condition. A medical professional has been notified. Please visit the Emergency Room immediately or call our Hospital Emergency Line at 📞 +880 1700-000000 / (02) 987654.';
      session.status = 'flagged_red';
    } else if (randomCategory === 'yellow') {
      botReplyText = '⚠️ YELLOW CATEGORY (Moderate Risk): Your symptoms have been logged for practitioner review. If your condition deteriorates, please call our Hospital Help Desk at 📞 +880 1800-000000.';
    } else {
      botReplyText = '✅ GREEN CATEGORY (Routine / Low Risk): Your screening is logged. For general hospital inquiries or appointments, call 📞 +880 1900-000000.';
    }

    const botMsg = {
      sender: 'bot',
      text: botReplyText,
      timestamp: new Date(),
    };
    session.messages.push(botMsg);

    // Update patient triage category in MongoDB
    await PatientTriage.findByIdAndUpdate(session.triageId, {
      category: randomCategory,
      reviewStatus: 'pending',
      'aiAnalysis.symptomSummary': `Screened via chat: "${text.trim().substring(0, 100)}"`,
      'aiAnalysis.confidenceScore': parseFloat((Math.random() * 0.2 + 0.8).toFixed(2)),
    });

    await session.save();
    res.json(session.messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getUserChats = async (req, res) => {
  try {
    const chats = await ChatSession.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
