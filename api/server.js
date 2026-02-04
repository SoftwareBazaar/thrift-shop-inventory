const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(bodyParser.json());

const changePassword = require('./auth/change-password');
const login = require('./auth/login');
const profile = require('./auth/profile');
const sendVerificationEmail = require('./auth/send-verification-email');
const verifyCode = require('./auth/verify-code');
const recoverPassword = require('./auth/recover-password');

app.options('/api/auth/change-password', (req, res) => res.sendStatus(200));
app.post('/api/auth/change-password', changePassword);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', profile);
app.post('/api/auth/send-verification-email', sendVerificationEmail);
app.post('/api/auth/verify-code', verifyCode);
app.post('/api/auth/recover-password', recoverPassword);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

