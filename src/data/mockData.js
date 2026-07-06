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

// Static OTP for verification simulation

export const MOCK_OTP = '123456';

// Set of registered phone numbers to simulate uniqueness check
export const registeredPhones = new Set(['01700000000']);

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
