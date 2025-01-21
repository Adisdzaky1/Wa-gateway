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
  try {
    const { data, error } = await supabase
      .from('whatsapp_sessions')
      .select('auth_state')
      .eq('number', number)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error(`Error fetching session for ${number}:`, error.message);
      throw new Error(error.message);
    }

    if (data && data.auth_state) {
      try {
        return JSON.parse(data.auth_state);
      } catch (e) {
        console.error(`Error parsing auth state for ${number}:`, e.message);
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error(`Error in getSession:`, err.message);
    return null;
  }
}

// Fungsi untuk menyimpan sesi ke Supabase
async function saveSession(number, state) {
  try {
    const { error } = await supabase
      .from('whatsapp_sessions')
      .upsert([{ number, auth_state: JSON.stringify(state) }]);

    if (error) {
      console.error(`Error saving session for ${number}:`, error.message);
      throw new Error(error.message);
    }
  } catch (err) {
    console.error(`Error in saveSession:`, err.message);
  }
}

module.exports = async (req, res) => {
  try {
    const number = req.query.number;
    if (!number) {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter "number" is required',
      });
    }

    // Fungsi untuk koneksi ke WhatsApp
    async function connectToWhatsApp() {
      try {
        // Ambil session dari database
        const savedState = await getSession(number);
        const authState = savedState || {};
        const usePairingCode = true;

        const sock = makeWASocket({
          logger: pino({ level: 'silent' }),
          auth: authState,
          printQRInTerminal: !usePairingCode,
          browser: ['Ubuntu', 'Chrome', '20.0.04'],
        });

        // Event handler untuk koneksi
        sock.ev.on('connection.update', async (update) => {
          const { qr, connection, lastDisconnect, pairingCode } = update;

          if (qr) {
            const qrImage = await QRCode.toDataURL(qr);
            return res.status(200).json({
              status: 'success',
              qrCode: qrImage,
              message: `QR code for ${number} generated successfully`,
            });
          }

          if (pairingCode) {
            return res.status(200).json({
              status: 'success',
              pairingCode,
              message: `Pairing code for ${number} generated successfully`,
            });
          }

          if (connection === 'open') {
            console.log(`Connected to WhatsApp for number: ${number}`);
            if (sock?.user) {
              console.log(`User: ${sock.user.id} connected`);
            } else {
              console.warn('User information is undefined');
            }
          }

          if (connection === 'close') {
            const reason =
              lastDisconnect?.error?.output?.statusCode || 'Unknown Reason';
            console.log(`Connection closed for number: ${number} - Reason: ${reason}`);

            if (reason !== DisconnectReason.loggedOut) {
              console.log('Reconnecting...');
              await connectToWhatsApp();
            } else {
              console.log('User logged out, clearing session');
              await saveSession(number, {});
            }
          }
        });

        // Simpan kredensial saat diperbarui
        sock.ev.on('creds.update', async (newState) => {
          try {
            await saveSession(number, newState);
          } catch (err) {
            console.error(`Failed to save session for ${number}:`, err.message);
          }
        });

        // Permintaan pairing code jika diperlukan
        if (usePairingCode) {
          const code = await sock.requestPairingCode(number);
          console.log(`Pairing code for ${number}: ${code}`);
        }

      } catch (error) {
        console.error(`Error during WhatsApp connection:`, error.message);
        res.status(500).json({
          status: 'error',
          message: 'Failed to connect to WhatsApp',
        });
      }
    }

    await connectToWhatsApp();
  } catch (error) {
    console.error(`Error for number: ${req.query.number || 'unknown'} -`, error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
