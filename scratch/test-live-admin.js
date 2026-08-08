

async function testLive() {
  try {
    // 1. Register a test admin
    const regRes = await fetch('https://sos-care.onrender.com/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Admin',
        phone: '9999999999',
        password: 'password123',
        role: 'admin',
        adminSecret: 'LKH-2026-ROOT'
      })
    });
    
    // It might fail if phone already exists, so let's just login
    const loginRes = await fetch('https://sos-care.onrender.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9999999999',
        password: 'password123'
      })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData);
    
    if (!loginData.token) {
      console.log('No token. Exiting.');
      process.exit(1);
    }
    
    // 2. Fetch analytics
    const analyticsRes = await fetch('https://sos-care.onrender.com/api/admin/analytics', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const analyticsData = await analyticsRes.json();
    console.log('Analytics Response HTTP:', analyticsRes.status);
    console.log('Analytics Data:', analyticsData);
    
  } catch (err) {
    console.error(err);
  }
}

testLive();
