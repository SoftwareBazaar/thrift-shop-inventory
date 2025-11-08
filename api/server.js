const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

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

app.options('/api/auth/change-password', (req, res) => res.sendStatus(200));
app.post('/api/auth/change-password', changePassword);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', profile);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

