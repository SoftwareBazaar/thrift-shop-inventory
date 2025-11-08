const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());

const changePassword = require('./auth/change-password');
const login = require('./auth/login');
const profile = require('./auth/profile');

app.post('/api/auth/change-password', changePassword);
app.post('/api/auth/login', login);
app.get('/api/auth/profile', profile);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Mock API server running on port ${PORT}`);
});

