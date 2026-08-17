import { LegalPageShell } from "@/components/legal/legal-page-shell";
import { getHelloEmail, siteConfig } from "@/config/site";

export const metadata = {
  title: "Syarat & Ketentuan",
  description: `Syarat dan ketentuan penggunaan layanan ${siteConfig.name}.`,
};

export default function TermsPage() {
  const helloEmail = getHelloEmail();

  return (
    <LegalPageShell title="Syarat & Ketentuan" updatedAt="5 Agustus 2026">
      <p>
        Dengan mendaftar atau menggunakan {siteConfig.name}, Anda setuju dengan syarat
        dan ketentuan berikut. Jika tidak setuju, mohon tidak menggunakan
        layanan ini.
      </p>

      <h2>1. Layanan</h2>
      <p>
        {siteConfig.name} menyediakan alat bantu pencatatan keuangan keluarga via
        WhatsApp dengan integrasi Google Sheet. Scan struk, analitik, kategori
        custom, dan fitur lainnya tersedia dalam satu paket langganan.
      </p>

      <h2>2. Akun & trial</h2>
      <ul>
        <li>Anda wajib memberikan informasi akun yang benar.</li>
        <li>Pengguna baru mendapat trial gratis selama periode yang
          ditampilkan di situs (saat ini 7 hari).</li>
        <li>Setelah trial berakhir, Anda perlu berlangganan
          untuk melanjutkan akses penuh.</li>
      </ul>

      <h2>3. Langganan & pembayaran</h2>
      <ul>
        <li>
          Langganan berbayar ditagih <strong>secara otomatis setiap bulan</strong>{" "}
          melalui Midtrans hingga Anda membatalkan perpanjangan otomatis.
        </li>
        <li>Harga paket tertera di halaman utama dan dapat berubah untuk
          langganan baru; perubahan akan diberitahukan sebelumnya.</li>
        <li>Anda dapat membatalkan perpanjangan otomatis kapan saja dari
          halaman Pengaturan. Akses tetap aktif sampai akhir periode yang
          sudah dibayar.</li>
        <li>Pengembalian dana mengikuti kebijakan kami dan ketentuan
          penyedia pembayaran, kecuali diwajibkan oleh hukum.</li>
      </ul>

      <h2>4. Google Sheet & WhatsApp</h2>
      <ul>
        <li>Anda bertanggung jawab atas akun Google dan WhatsApp yang
          dihubungkan.</li>
        <li>Data transaksi disimpan di Google Sheet milik Anda; kami tidak
          menjadi pemilik data tersebut.</li>
        <li>Anda memberi izin teknis agar {siteConfig.name} dapat menulis ke Sheet
          dan menerima pesan dari nomor WhatsApp yang Anda hubungkan.</li>
      </ul>

      <h2>5. Penggunaan yang dilarang</h2>
      <ul>
        <li>Menggunakan layanan untuk aktivitas ilegal atau melanggar hukum.</li>
        <li>Mencoba mengakses sistem, data pengguna lain, atau API tanpa
          izin.</li>
        <li>Menyalahgunakan bot WhatsApp (spam, otomatisasi massal, dll.).</li>
      </ul>

      <h2>6. Ketersediaan layanan</h2>
      <p>
        Kami berupaya menjaga layanan tersedia, namun tidak menjamin uptime
        100%. Integrasi WhatsApp (Baileys) bergantung pada koneksi perangkat
        Anda dan dapat terputus sewaktu-waktu. Fitur AI parsing dapat
        menghasilkan kesalahan — selalu verifikasi data di Sheet Anda.
      </p>

      <h2>7. Batas tanggung jawab</h2>
      <p>
        {siteConfig.name} disediakan &quot;sebagaimana adanya&quot;. Kami tidak
        bertanggung jawab atas kerugian tidak langsung, kehilangan data di
        Google Sheet akibat kesalahan pengguna, atau keputusan keuangan
        berdasarkan analitik aplikasi. Layanan ini bukan nasihat keuangan
        profesional.
      </p>

      <h2>8. Penghentian</h2>
      <p>
        Kami dapat menangguhkan atau menghentikan akun yang melanggar syarat
        ini. Anda dapat berhenti menggunakan layanan kapan saja dan meminta
        penghapusan akun melalui{" "}
        <a href={`mailto:${helloEmail}`}>{helloEmail}</a>.
      </p>

      <h2>9. Hukum yang berlaku</h2>
      <p>
        Syarat ini diatur oleh hukum Republik Indonesia. Sengketa akan
        diselesaikan secara musyawarah terlebih dahulu.
      </p>

      <h2>10. Kontak</h2>
      <p>
        Pertanyaan terkait syarat layanan:{" "}
        <a href={`mailto:${helloEmail}`}>{helloEmail}</a>
      </p>
    </LegalPageShell>
  );
}
