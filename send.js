const { default: makeWASocket } = require('@whiskeysockets/baileys');

module.exports = async (req, res) => {
  const { product, id, nominal, tujuan, tanggal, number } = req.query;

  // Validasi parameter
  if (!product || !id || !nominal || !tujuan || !tanggal || !number) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Semua parameter (product, id, nominal, tujuan, tanggal, number) harus diisi.' 
    });
  }

  try {
    const sock = makeWASocket();

    sock.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        const formattedNumber = `${number}@s.whatsapp.net`;

        // Pesan dengan format tertentu
        const message = `Halo Pelanggan Yang Terhormat,

Terima kasih telah mempercayai dan melakukan top-up di _*Ayo Topup*_.
Berikut detail transaksi Anda:

*Produk:* _${product}_
*Id:* _${id}_
*Nominal:* _${nominal}_
*Tujuan:* _${tujuan}_
*Waktu Transaksi:* _${tanggal}_

Transaksi Anda telah berhasil dilakukan. Jika ada pertanyaan atau kendala, jangan ragu untuk menghubungi tim kami.

_*Salam Hangat, 
Tim Ayo Topup*_
> *Website:* ayo-topup.xyz

*Support:*
1. *WhatsApp:* _wa.me/+6285877276864_
2. *Telegram:* _t.me/Oficiallz_
3. *Email:* _adisdzakyrivai@gmail.com_`;

        // Kirim pesan dengan tombol "Kunjungi Website" dan "Hubungi Kami"
        sock.sendMessage(formattedNumber, {
          text: message
        })
          .then(() => {
            res.status(200).json({ status: 'success', message: 'Message with buttons sent' });
          })
          .catch((err) => {
            res.status(500).json({ status: 'error', message: err.message });
          });
      }

      if (update.connection === 'close') {
        console.log('Connection closed:', update.lastDisconnect?.error);
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};