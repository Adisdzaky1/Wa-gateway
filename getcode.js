const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason 
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');

module.exports = async (req, res) => {
  try {
    // Pastikan direktori auth_info ada
    const authPath = '/tmp/auth_info';
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    // Gunakan auth state
    const { state, saveState } = await useMultiFileAuthState(authPath);
    if (!saveState) {
      throw new Error('saveState tidak terdefinisi!');
    }

    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // Listener connection.update
    sock.ev.on('connection.update', async (update) => {
      const { qr, connection } = update;

      if (qr) {
        const qrCode = await QRCode.toDataURL(qr);
        return res.status(200).json({ status: 'success', qrCode });
      }

      if (connection === 'open') {
        console.log('Connected to WhatsApp!');
      }

      if (connection === 'close') {
        console.log('Connection closed:', update);
      }
    });

    // Listener creds.update
    sock.ev.on('creds.update', saveState);

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ status: 'kesalahan', message: error.message });
  }
};
