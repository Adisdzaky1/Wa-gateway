const {
  default: makeWASocket,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const { createClient } = require('@supabase/supabase-js');

// Konfigurasi Supabase
const SUPABASE_URL = 'https://jaxxpsxndwzrxzenkjrd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpheHhwc3huZHd6cnh6ZW5ranJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0MzUzNjAsImV4cCI6MjA1MzAxMTM2MH0.4rnC-sfGYkW9ydjKWroi_6dBWJzbZxQZjO8NDzlkmjc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fungsi untuk mendapatkan sesi dari Supabase
async function getSession(number) {
  const { data, error } = await supabase
    .from('whatsapp_sessions')
    .select('auth_state')
    .eq('number', number)
    .single();

  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  return data ? JSON.parse(data.auth_state) : null;
}

// Fungsi untuk menyimpan sesi ke Supabase
async function saveSession(number, state) {
  const { error } = await supabase
    .from('whatsapp_sessions')
    .upsert([{ number, auth_state: JSON.stringify(state) }]);

  if (error) throw new Error(error.message);
}

module.exports = async (req, res) => {
  try {
    const number = req.query.number;
    if (!number) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Parameter "number" is required' });
    }

    // Ambil session dari database
    const savedState = await getSession(number);
    const authState = savedState || {};

    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      auth: authState,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    sock.ev.on('connection.update', async (update) => {
      const { qr, connection, lastDisconnect, pairingCode } = update;

      if (pairingCode) {
        return res.status(200).json({
          status: 'success',
          pairingCode,
          message: `Pairing code for ${number} generated successfully`,
        });
      }

      if (qr) {
        const qrImage = await QRCode.toDataURL(qr);
        return res.status(200).json({
          status: 'success',
          qrCode: qrImage,
          message: `QR code for ${number} generated successfully`,
        });
      }

      if (connection === 'open') {
        console.log(`Connected to WhatsApp for number: ${number}`);
      }

      if (connection === 'close') {
        const reason =
          lastDisconnect?.error?.output?.statusCode || 'Unknown Reason';
        console.log(`Connection closed for number: ${number} - Reason: ${reason}`);

        if (reason !== DisconnectReason.loggedOut) {
          console.log('Reconnecting...');
          await module.exports(req, res);
        }
      }
    });

    sock.ev.on('creds.update', async (newState) => {
      await saveSession(number, newState);
    });
  } catch (error) {
    console.error(`Error for number: ${req.query.number} -`, error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
