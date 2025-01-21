const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
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
  const { product, id, nominal, tujuan, tanggal, number } = req.query;

  // Validasi parameter
  if (!product || !id || !nominal || !tujuan || !tanggal || !number) {
    return res.status(400).json({
      status: 'error',
      message: 'Semua parameter (product, id, nominal, tujuan, tanggal, number) harus diisi.',
    });
  }

  try {
    // Ambil sesi dari database Supabase
    const savedState = await getSession(number);
    if (!savedState) {
      return res.status(400).json({
        status: 'error',
        message: 'Nomor ini belum terhubung ke WhatsApp. Silakan lakukan pairing terlebih dahulu.',
      });
    }

    const sock = makeWASocket({
      auth: savedState,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
    });

    sock.ev.on('connection.update', async (update) => {
      if (update.connection === 'open') {
        const formattedNumber = `${number}@s.whatsapp.net`;

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

        // Kirim pesan ke nomor tujuan
        sock.sendMessage(formattedNumber, { text: message })
          .then(() => {
            res.status(200).json({ status: 'success', message: 'Pesan berhasil dikirim' });
          })
          .catch((err) => {
            res.status(500).json({ status: 'error', message: err.message });
          });
      }

      if (update.connection === 'close') {
        console.log('Koneksi terputus:', update.lastDisconnect?.error);

        const reason = update.lastDisconnect?.error?.output?.statusCode || 'Unknown Reason';
        if (reason !== DisconnectReason.loggedOut) {
          console.log('Mencoba menyambung ulang...');
          await module.exports(req, res);
        }
      }
    });

    // Simpan sesi saat diperbarui
    sock.ev.on('creds.update', async (newState) => {
      await saveSession(number, newState);
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
};
