const express = require('express');
const sendHandler = require('./send'); // Import file send.js
const getcodeHandler = require('./getcode');
const app = express();

app.use(express.json());

// Route untuk endpoint send
app.get('/api/send', sendHandler);

app.get('/api/getcode', getcodeHandler);


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Konfigurasi untuk Vercel
module.exports = app;
