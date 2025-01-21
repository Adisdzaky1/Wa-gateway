const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason 
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

module.exports = async (req, res) => {
  try {
    const number = req.query.number; // Ambil parameter 'number' dari query
    if (!number) {
      return res.status(400).json({ status: 'error', message: 'Parameter "number" is required' });
    }

    const { state, saveState } = await useMultiFileAuthState('/tmp/auth_info'); // Pastikan path benar
    const sock = makeWASocket({
      logger: pino({ level: 'silent' }),
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sock.ev.on('connection.update', async (update) => {
      const { qr, connection, lastDisconnect, pairingCode } = update;

      if (pairingCode) {
        // Kirim pairing code
        return res.status(200).json({ 
          status: 'success', 
          pairingCode, 
          message: `Pairing code for ${number} sent successfully` 
        });
      }

      if (qr) {
        // Kirim QR code jika pairing code tidak digunakan
        const qrImage = await QRCode.toDataURL(qr);
        return res.status(200).json({ 
          status: 'success', 
          qrCode: qrImage, 
          message: `QR code for ${number} generated successfully` 
        });
      }

      if (connection === 'open') {
        console.log(`Connected to WhatsApp for number: ${number}`);
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error).output.payload.message;
        console.log(`Connection closed for number: ${number} - Reason: ${reason}`);

        if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
          console.log('Reconnecting...');
          await module.exports(req, res); // Restart koneksi
        }
      }
    });

    sock.ev.on('creds.update', saveState); // Simpan state setiap kali diperbarui
  } catch (error) {
    console.error(`Error for number: ${req.query.number} -`, error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
