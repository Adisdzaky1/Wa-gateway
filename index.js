const express = require('express');
const sendHandler = require('./send'); // Import file send.js
const getcodeHandler = require('./getcode');
const app = express();

app.use(express.json());

// Route untuk endpoint send
app.get('/api/send', sendHandler);

app.get('/api/getcode', getcodeHandler);

// Konfigurasi untuk Vercel
module.exports = app;
