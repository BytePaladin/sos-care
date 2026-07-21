import { PatientTriage } from '../models/PatientTriage.js';
import { ChatSession } from '../models/ChatSession.js';

export const getPatients = async (req, res) => {
  try {
    const patients = await PatientTriage.find()
      .populate('reviewedBy', 'name staffRole')
      .populate('forwardedTo', 'name staffRole')
      .sort({ screenedAt: -1 });

    const patientIds = patients.map((p) => p._id);
    const chatSessions = await ChatSession.find({ triageId: { $in: patientIds } });

    const formattedPatients = patients.map((p) => {
      const pObj = p.toObject();
      const session = chatSessions.find((cs) => cs.triageId.toString() === p._id.toString());
      return {
        _id: pObj._id,
        id: pObj._id.toString(),
        patientName: pObj.patientName,
        name: pObj.patientName,
        patientPhone: pObj.patientPhone,
        phone: pObj.patientPhone,
        category: pObj.category,
        aiAnalysis: pObj.aiAnalysis,
        reviewStatus: pObj.reviewStatus,
        reviewComment: pObj.reviewComment,
        reviewedBy: pObj.reviewedBy ? pObj.reviewedBy.name : null,
        reviewedAt: pObj.reviewedAt,
        forwardedTo: pObj.forwardedTo ? pObj.forwardedTo._id.toString() : null,
        forwardedToName: pObj.forwardedTo ? pObj.forwardedTo.name : null,
        notes: pObj.notes || [],
        screenedAt: pObj.screenedAt,
        chatHistory: session ? session.messages : [],
      };
    });

    res.json(formattedPatients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePatientStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewStatus, reviewComment, forwardedTo } = req.body;

    const patient = await PatientTriage.findById(id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient triage record not found' });
    }

    if (reviewStatus) {
      patient.reviewStatus = reviewStatus;
    }
    if (reviewComment !== undefined) {
      patient.reviewComment = reviewComment;
    }
    if (forwardedTo !== undefined) {
      patient.forwardedTo = forwardedTo || null;
    }

    patient.reviewedBy = req.user._id;
    patient.reviewedAt = new Date();

    await patient.save();

    const updated = await PatientTriage.findById(id)
      .populate('reviewedBy', 'name staffRole')
      .populate('forwardedTo', 'name staffRole');

    const session = await ChatSession.findOne({ triageId: id });
    const pObj = updated.toObject();

    res.json({
      _id: pObj._id,
      id: pObj._id.toString(),
      patientName: pObj.patientName,
      name: pObj.patientName,
      patientPhone: pObj.patientPhone,
      phone: pObj.patientPhone,
      category: pObj.category,
      aiAnalysis: pObj.aiAnalysis,
      reviewStatus: pObj.reviewStatus,
      reviewComment: pObj.reviewComment,
      reviewedBy: pObj.reviewedBy ? pObj.reviewedBy.name : null,
      reviewedAt: pObj.reviewedAt,
      forwardedTo: pObj.forwardedTo ? pObj.forwardedTo._id.toString() : null,
      forwardedToName: pObj.forwardedTo ? pObj.forwardedTo.name : null,
      notes: pObj.notes || [],
      screenedAt: pObj.screenedAt,
      chatHistory: session ? session.messages : [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addPatientNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Note text is required' });
    }

    const patient = await PatientTriage.findById(id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient triage record not found' });
    }

    const newNote = {
      author: req.user.name + (req.user.staffRole ? ` (${req.user.staffRole})` : ''),
      authorId: req.user._id,
      text: text.trim(),
      timestamp: new Date(),
    };

    patient.notes.push(newNote);
    await patient.save();

    res.status(201).json(patient.notes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
