import nodemailer from 'nodemailer';

const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.VITE_EMAIL_USER,
      pass: process.env.VITE_EMAIL_PASS,
    },
  });
};

export const sendEmail = async (to, subject, html) => {
  const transporter = getTransporter();
  const mailOptions = {
    from: `"S.O.S. Care" <${process.env.VITE_EMAIL_USER}>`,
    to,
    subject,
    html,
  };
  return await transporter.sendMail(mailOptions);
};

export const sendTriageOverrideEmail = async (to, patientName, newCategory, transitionType) => {
  const categoryUpper = newCategory.toUpperCase();
  
  let explanation = '';
  if (newCategory === 'red') {
    explanation = 'Your symptoms have been marked as HIGH PRIORITY by our medical staff. A member of the medical team will be alerting you shortly. If your condition worsens, please go to the nearest Emergency Room immediately.';
  } else if (newCategory === 'yellow') {
    explanation = 'Your case has been categorized as MODERATE PRIORITY. Our medical team is reviewing your symptoms and you will be scheduled for a practitioner review soon.';
  } else {
    explanation = 'Your case has been categorized as ROUTINE. The care team will respond in the normal cycle. For appointments or general queries, please contact our help desk.';
  }

  const subject = `Update on Your S.O.S. Care Triage Status`;
  
  const html = `
    <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333;">
      <h2 style="color: #2c3e50;">Hello ${patientName || 'Patient'},</h2>
      <p>A doctor has reviewed your symptom screening and updated your priority level.</p>
      
      <div style="margin: 20px 0; padding: 15px; border-left: 4px solid ${
        newCategory === 'red' ? '#e74c3c' : newCategory === 'yellow' ? '#f39c12' : '#2ecc71'
      }; background-color: #f9f9f9;">
        <h3 style="margin-top: 0; color: ${
          newCategory === 'red' ? '#e74c3c' : newCategory === 'yellow' ? '#f39c12' : '#2ecc71'
        };">New Priority: ${categoryUpper}</h3>
        <p style="margin-bottom: 0;"><strong>What this means for you:</strong> ${explanation}</p>
      </div>
      
      <p>If you have any immediate concerns, please call our 24/7 help desk.</p>
      <br />
      <p style="font-size: 0.9em; color: #7f8c8d;">
        Take care,<br />
        The S.O.S. Care Medical Team
      </p>
    </div>
  `;

  return await sendEmail(to, subject, html);
};
