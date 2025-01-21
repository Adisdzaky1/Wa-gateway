const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  generateForwardMessageContent, 
  prepareWAMessageMedia, 
  generateWAMessageFromContent, 
  generateMessageID, 
  downloadContentFromMessage, 
  makeInMemoryStore, 
  jidDecode, 
  proto, 
  getAggregateVotesInPollMessage 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');
const pino = require('pino'); // Tambahkan pino jika belum ada
const { state, saveState } = await useMultiFileAuthState('./auth_info'); // Pastikan path sesuai

const usePairingCode = true; // Aktifkan pairing code

module.exports = async (req, res) => {
  try {
    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: !usePairingCode,
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('connection.update', async (update) => {
      const { qr, connection, lastDisconnect, pairingCode } = update;

      if (usePairingCode && pairingCode) {
        // Kirim pairing code jika diaktifkan
        res.status(200).json({ status: 'success ', pairingCode });
      }

      if (!usePairingCode && qr) {
        // Kirim QR code jika pairing code tidak digunakan
        const qrImage = await QRCode.toDataURL(qr);
        res.status(200).json({ status: 'success', qrCode: qrImage });
      }

      if (connection === 'open') {
        console.log('Connected to WhatsApp!');
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error).output.payload;
        console.log('Connection closed:', reason);

        // Tangani jika terputus karena alasan tertentu
        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
          console.log('Reconnecting...');
          await module.exports(req, res); // Restart koneksi
        }
      }
    });

    sock.ev.on('creds.update', saveState); // Simpan state setiap kali diperbarui
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};