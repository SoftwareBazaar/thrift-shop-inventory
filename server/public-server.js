const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'online', 
    timestamp: new Date().toISOString(),
    system: 'Thrift Shop Inventory Management',
    version: '1.0.0'
  });
});

// API endpoint for system status
app.get('/api/status', (req, res) => {
  res.json({
    system: 'Thrift Shop Inventory Management System',
    status: 'online',
    features: [
      'Inventory Management',
      'Sales Tracking', 
      'User Management',
      'Analytics & Reports',
      'AI Automation',
      'Responsive Design'
    ],
    access: {
      main: 'http://197.248.249.141:3001',
      login: 'http://197.248.249.141:3001/login',
      api: 'http://197.248.249.141:5001'
    },
    credentials: {
      admin: 'admin / admin123',
      john: 'john / admin123', 
      geoffrey: 'geoffrey / admin123'
    }
  });
});

// Redirect to main application
app.get('/app', (req, res) => {
  res.redirect('http://197.248.249.141:3001');
});

// Redirect to login
app.get('/login', (req, res) => {
  res.redirect('http://197.248.249.141:3001/login');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Public server running on port ${PORT}`);
  console.log(`📱 Shareable link: http://197.248.249.141:${PORT}`);
  console.log(`🔗 Main app: http://197.248.249.141:3001`);
  console.log(`🔑 Login: http://197.248.249.141:3001/login`);
});
