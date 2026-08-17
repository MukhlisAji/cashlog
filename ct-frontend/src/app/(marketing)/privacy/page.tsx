import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { getHelloEmail, siteConfig } from "@/config/site";

export const metadata = {
  title: "Kebijakan Privasi",
  description: `Kebijakan privasi ${siteConfig.name} — bagaimana kami menangani data akun dan privasi transaksi Anda.`,
};

export default function PrivacyPage() {
  const helloEmail = getHelloEmail();

  return (
    <LegalPageShell title="Kebijakan Privasi" updatedAt="5 Agustus 2026">
      <p>
        {siteConfig.name} (&quot;kami&quot;) berkomitmen melindungi privasi Anda. Kebijakan
        ini menjelaskan data apa yang kami proses, bagaimana kami
        menggunakannya, dan hak Anda sebagai pengguna.
      </p>

      <h2>1. Ringkasan</h2>
      <p>
        {siteConfig.name} adalah layanan pencatatan keuangan keluarga via WhatsApp yang
        menyimpan <strong>data transaksi di Google Sheet milik Anda</strong>.
        Kami tidak menyimpan riwayat transaksi di server {siteConfig.name}.
      </p>

      <h2>2. Data yang kami kumpulkan</h2>
      <ul>
        <li>
          <strong>Data akun:</strong> nama, email, foto profil (jika login via
          Google), status langganan.
        </li>
        <li>
          <strong>Koneksi layanan:</strong> ID spreadsheet Google Sheet yang
          Anda hubungkan, status koneksi WhatsApp (nomor telepon dan status
          terhubung/putus — bukan isi pesan).
        </li>
        <li>
          <strong>Data pembayaran:</strong> informasi langganan (paket, tanggal
          berakhir). Detail kartu/pembayaran diproses langsung oleh Midtrans; kami
          tidak menyimpan nomor kartu.
        </li>
        <li>
          <strong>Data teknis:</strong> log server untuk keamanan dan
          troubleshooting (misalnya waktu request, error).
        </li>
      </ul>

      <h2>3. Data yang TIDAK kami simpan</h2>
      <ul>
        <li>Isi pesan WhatsApp Anda sehari-hari (kecuali diproses sementara untuk parsing, tanpa disimpan permanen).</li>
        <li>Detail transaksi (nominal, kategori, tanggal) — data ini hanya ditulis ke Google Sheet Anda.</li>
        <li>Foto struk — diproses untuk ekstraksi teks, tidak disimpan sebagai arsip di server kami.</li>
      </ul>

      <h2>4. Bagaimana kami menggunakan data</h2>
      <ul>
        <li>Menyediakan layanan catat transaksi, dashboard ringkasan, dan fitur Pro.</li>
        <li>Mengelola trial dan langganan berbayar.</li>
        <li>Mengirim email transaksional (selamat datang, konfirmasi langganan).</li>
        <li>Menjaga keamanan dan mencegah penyalahgunaan.</li>
      </ul>

      <h2>5. Berbagi data dengan pihak ketiga</h2>
      <p>Kami menggunakan penyedia layanan tepercaya:</p>
      <ul>
        <li><strong>Supabase</strong> — autentikasi dan profil akun.</li>
        <li><strong>Google</strong> — OAuth dan Google Sheets API (data Sheet milik akun Google Anda).</li>
        <li><strong>Midtrans</strong> — pemrosesan pembayaran langganan.</li>
        <li><strong>Resend</strong> — pengiriman email notifikasi.</li>
        <li><strong>OpenAI / Google Gemini</strong> — parsing pesan/struk (teks yang dikirim untuk diproses, tanpa disimpan sebagai riwayat transaksi).</li>
      </ul>
      <p>
        Kami tidak menjual data pribadi Anda kepada pihak ketiga.
      </p>

      <h2>6. Penyimpanan & keamanan</h2>
      <p>
        Metadata akun disimpan di infrastruktur cloud dengan akses terbatas.
        Sesi WhatsApp disimpan terenkripsi di server backend untuk menjaga
        koneksi. Anda dapat memutus koneksi WhatsApp kapan saja dari
        pengaturan.
      </p>

      <h2>7. Hak Anda</h2>
      <ul>
        <li>Mengakses dan memperbarui profil akun.</li>
        <li>Memutus koneksi Google Sheet dan WhatsApp.</li>
        <li>Membatalkan perpanjangan otomatis langganan.</li>
        <li>Meminta penghapusan akun — hubungi{" "}
          <a href={`mailto:${helloEmail}`}>{helloEmail}</a>.
        </li>
      </ul>

      <h2>8. Cookie</h2>
      <p>
        Kami menggunakan cookie sesi untuk autentikasi dan mode demo (jika
        diaktifkan). Cookie esensial diperlukan agar layanan berfungsi.
      </p>

      <h2>9. Perubahan kebijakan</h2>
      <p>
        Kami dapat memperbarui kebijakan ini. Perubahan material akan
        diberitahukan melalui email atau pemberitahuan di situs.
      </p>

      <h2>10. Kontak</h2>
      <p>
        Pertanyaan privasi:{" "}
        <a href={`mailto:${helloEmail}`}>{helloEmail}</a>
      </p>
    </LegalPageShell>
  );
}
