// Mock hospital data for the landing page
export const hospitals = [
  {
    id: 'kidney-care',
    name: 'Imaginary Kidney Care Hospital',
    specialty: 'Nephrology & Renal Care',
    description: 'Comprehensive kidney disease screening, dialysis support, and transplant coordination powered by AI-driven symptom analysis.',
    logo: '/kidney-hospital-logo.png',
    featured: true,
  },
  {
    id: 'city-general',
    name: 'City General Hospital',
    specialty: 'General Medicine',
    description: 'Full-spectrum medical services including emergency care, diagnostics, and outpatient consultations.',
    emoji: '🏥',
    featured: false,
  },
  {
    id: 'sunrise-cardio',
    name: 'Sunrise Cardiology Center',
    specialty: 'Cardiology',
    description: 'Advanced cardiac care with state-of-the-art catheterization labs and heart failure management programs.',
    emoji: '❤️‍🩹',
    featured: false,
  },
  {
    id: 'greenleaf-neuro',
    name: 'Greenleaf Neuro Institute',
    specialty: 'Neurology',
    description: 'Specialized neurological diagnostics, stroke rehabilitation, and neurodegenerative disease management.',
    emoji: '🧠',
    featured: false,
  },
];

// Simulated user database for login/signup
export const mockUsers = [
  {
    name: 'Demo Patient',
    phone: '01700000000',
    password: 'Demo@1234',
  },
];

// Simulated staff database for login
export const mockStaffUsers = [
  {
    id: 'doc-1',
    name: 'Dr. Nusrat Jahan',
    phone: '01800000000',
    password: 'Staff@1234',
    role: 'Chief Nephrologist',
    telegramChatId: '',
    telegramOptIn: true,
  },
  {
    id: 'doc-2',
    name: 'Dr. Tanvir Ahmed',
    phone: '01900000000',
    password: 'Staff@1234',
    role: 'Resident Physician',
    telegramChatId: '',
    telegramOptIn: false,
  },
];

// Static OTP for verification simulation
export const MOCK_OTP = '123456';

// Set of registered phone numbers to simulate uniqueness check
export const registeredPhones = new Set(['01700000000', '01800000000', '01900000000']);

// Canned health-related bot responses for the chat dashboard
export const cannedResponses = [
  "I understand your concern. Could you tell me more about when these symptoms started?",
  "Based on what you've described, I'd recommend monitoring your fluid intake and scheduling a follow-up with your nephrologist.",
  "That's a common symptom. Have you noticed any changes in your urination patterns or experienced any swelling?",
  "It's important to keep track of your blood pressure readings. Have you been measuring it regularly?",
  "I'd suggest getting a basic metabolic panel done. This will help us check your kidney function markers like creatinine and BUN levels.",
  "Thank you for sharing that information. Let me note that down. Is there anything else you'd like to discuss?",
  "Staying hydrated is crucial for kidney health, but the right amount depends on your specific condition. What has your doctor recommended?",
  "Some medications can affect kidney function. Could you list any medications or supplements you're currently taking?",
  "Early detection is key in managing kidney conditions. Regular screening can make a significant difference in outcomes.",
  "I'll add this to your symptom log. Your healthcare provider will be able to review this during your next visit.",
];

// Mock recent chat data for the sidebar
export const mockRecentChats = [
  { id: 1, title: 'Kidney Function Questions', preview: 'What are normal creatinine levels?', time: '2 min ago' },
  { id: 2, title: 'Medication Side Effects', preview: 'I noticed some swelling...', time: '1 hour ago' },
  { id: 3, title: 'Diet Recommendations', preview: 'What foods should I avoid?', time: '3 hours ago' },
  { id: 4, title: 'Lab Results Discussion', preview: 'My GFR came back at 58...', time: 'Yesterday' },
  { id: 5, title: 'Appointment Prep', preview: 'What should I ask my doctor?', time: '2 days ago' },
  { id: 6, title: 'Symptom Tracking', preview: 'I have been feeling fatigued...', time: '3 days ago' },
];

// Mock patient triage records for staff dashboard
export const mockScreenedPatients = [
  {
    id: 'pat-1',
    name: 'Rahima Begum',
    phone: '01711112222',
    category: 'red',
    screenedAt: '2026-07-21T10:30:00Z',
    chatHistory: [
      { role: 'user', text: 'Hello, I have been having severe swelling in my ankles and persistent lower back pain.' },
      { role: 'bot', text: 'Severe ankle swelling (edema) and lower back/kidney pain can be indicators of fluid retention or kidney strain. Are you experiencing fatigue or changes in urination?' },
      { role: 'user', text: 'Yes, I feel extremely tired all the time, and my urine is very dark and foamy.' },
      { role: 'bot', text: 'Foamy urine often suggests protein excretion, and dark urine combined with fatigue and swelling is a critical pattern. I highly recommend urgent medical review.' }
    ],
    reviewStatus: 'pending',
    reviewComment: '',
    notes: [
      { author: 'System', text: 'AI Screening classified patient as Red Alert: Foamy urine + severe bilateral edema + dark color.', timestamp: '2026-07-21T10:32:00Z' }
    ],
    forwardedTo: null,
    reviewedBy: null,
    reviewedAt: null
  },
  {
    id: 'pat-2',
    name: 'Abul Hossain',
    phone: '01722223333',
    category: 'red',
    screenedAt: '2026-07-21T09:15:00Z',
    chatHistory: [
      { role: 'user', text: 'My blood pressure is 180/110 and I have a headache.' },
      { role: 'bot', text: 'A blood pressure of 180/110 is in the hypertensive crisis range. Please consult emergency services immediately if you have chest pain, shortness of breath, or vision changes.' },
      { role: 'user', text: 'I also have a history of chronic kidney disease stage 3.' },
      { role: 'bot', text: 'Given your history of Stage 3 CKD, this level of blood pressure poses an immediate threat to your renal function. Seek emergency care.' }
    ],
    reviewStatus: 'pending',
    reviewComment: '',
    notes: [],
    forwardedTo: null,
    reviewedBy: null,
    reviewedAt: null
  },
  {
    id: 'pat-3',
    name: 'Nusrat Parveen',
    phone: '01733334444',
    category: 'yellow',
    screenedAt: '2026-07-21T08:00:00Z',
    chatHistory: [
      { role: 'user', text: 'I have some mild back ache and I feel a bit dehydrated.' },
      { role: 'bot', text: 'Dehydration can cause mild kidney area discomfort. Make sure to drink plenty of water. Have you had a fever?' },
      { role: 'user', text: 'No fever, just a general dull ache on the left side.' },
      { role: 'bot', text: 'A localized dull ache without fever warrants monitoring. If the pain intensifies, or if you develop a fever or urinary symptoms, please schedule an appointment.' }
    ],
    reviewStatus: 'pending',
    reviewComment: '',
    notes: [],
    forwardedTo: null,
    reviewedBy: null,
    reviewedAt: null
  },
  {
    id: 'pat-4',
    name: 'Kamal Uddin',
    phone: '01744445555',
    category: 'green',
    screenedAt: '2026-07-20T14:20:00Z',
    chatHistory: [
      { role: 'user', text: 'What is a normal fluid intake for healthy kidneys?' },
      { role: 'bot', text: 'For healthy individuals, drinking about 8-10 cups (2-2.5 liters) of water daily is generally recommended to help kidneys filter waste.' },
      { role: 'user', text: 'Thanks, I just wanted to verify if my current habit of 3L is okay.' },
      { role: 'bot', text: '3 liters is perfectly fine for active individuals with healthy kidneys. Keep up the good hydration!' }
    ],
    reviewStatus: 'pending',
    reviewComment: '',
    notes: [],
    forwardedTo: null,
    reviewedBy: null,
    reviewedAt: null
  },
  {
    id: 'pat-5',
    name: 'Sharmin Akter',
    phone: '01755556666',
    category: 'red',
    screenedAt: '2026-07-19T11:00:00Z',
    chatHistory: [
      { role: 'user', text: 'I have intense nausea and my skin has been itching like crazy, plus my legs are swollen.' },
      { role: 'bot', text: 'Nausea, severe skin itching (pruritus due to uremic toxins), and leg edema are classic symptoms of advanced kidney issues. Please see a doctor.' },
      { role: 'user', text: 'I can barely walk because of the swelling.' },
      { role: 'bot', text: 'This is a high-priority situation. Please visit an emergency clinic or contact your doctor immediately.' }
    ],
    reviewStatus: 'contacted',
    reviewComment: 'Spoke to patient. Advised to go to ER immediately. Patient confirmed they are on their way.',
    notes: [
      { author: 'Dr. Nusrat Jahan', text: 'Contacted patient via phone. Swelling confirmed bilateral, pitting. Nausea persistent for 3 days. Urged ER visit.', timestamp: '2026-07-19T11:15:00Z' }
    ],
    forwardedTo: null,
    reviewedBy: 'doc-1',
    reviewedAt: '2026-07-19T11:15:00Z'
  },
  {
    id: 'pat-6',
    name: 'Tariqul Islam',
    phone: '01766667777',
    category: 'yellow',
    screenedAt: '2026-07-20T16:45:00Z',
    chatHistory: [
      { role: 'user', text: 'Is it normal to have a metallic taste in my mouth?' },
      { role: 'bot', text: 'A metallic taste (dysgeusia) can sometimes be caused by a buildup of waste products in the blood (uremia) when kidneys aren\'t filtering fully. Are you having other symptoms?' },
      { role: 'user', text: 'Slight loss of appetite, but nothing else really.' },
      { role: 'bot', text: 'Loss of appetite and metallic taste are mild signs that warrant a routine kidney function blood test (creatinine/eGFR).' }
    ],
    reviewStatus: 'needs_review',
    reviewComment: '',
    notes: [
      { author: 'Dr. Tanvir Ahmed', text: 'Referred to Nephrology for eGFR screening.', timestamp: '2026-07-20T18:00:00Z' }
    ],
    forwardedTo: 'doc-1',
    reviewedBy: 'doc-2',
    reviewedAt: '2026-07-20T18:00:00Z'
  }
];
