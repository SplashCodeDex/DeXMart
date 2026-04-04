export const get = async (type: string): Promise<string> => {
    switch (type.toLowerCase()) {
        case 'osettext':
        case 'settext':
            return `*📋 Daftar Teks*\n\n` +
                `• \`goodbye\` - Teks saat anggota keluar\n` +
                `• \`intro\` - Teks intro/deskripsi grup\n` +
                `• \`welcome\` - Teks saat anggota masuk\n`;

        case 'mode':
            return `*📋 Daftar Mode*\n\n` +
                `• \`group\` - Hanya merespons di grup\n` +
                `• \`private\` - Hanya merespons di chat pribadi\n` +
                `• \`public\` - Merespons di mana saja\n` +
                `• \`self\` - Bebas digunakan hanya oleh Owner\n`;

        case 'setoption':
        case 'setopt':
            return `*📋 Daftar Opsi*\n\n` +
                `• \`antiaudio\` - Hapus otomatis pesan suara\n` +
                `• \`antidocument\` - Hapus otomatis berkas dokumen\n` +
                `• \`antigif\` - Hapus otomatis gambar bergerak\n` +
                `• \`antiimage\` - Hapus otomatis gambar\n` +
                `• \`antilink\` - Hapus otomatis tautan/link\n` +
                `• \`antinsfw\` - Deteksi dan hapus konten dewasa (NSFW)\n` +
                `• \`antispam\` - Blokir pengguna yang mengirim spam pesan\n` +
                `• \`antisticker\` - Hapus otomatis stiker\n` +
                `• \`antitagsw\` - Dilarang tag otomatis semua orang di grup\n` +
                `• \`antitoxic\` - Deteksi dan hapus kata-kata kasar\n` +
                `• \`antivideo\` - Hapus otomatis video\n` +
                `• \`autokick\` - Keluarkan otomatis anggota nakal (jika digabungkan opsi lainnya)\n` +
                `• \`gamerestrict\` - Matikan game di grup ini\n` +
                `• \`welcome\` - Kirim pesan selamat datang/keluar\n`;

        case 'group':
            return `*📋 Daftar Setelan Grup*\n\n` +
                `• \`open\` - Buka setelan grup agar semua bisa kirim pesan\n` +
                `• \`close\` - Tutup grup (hanya admin yang bisa mengirim pesan)\n` +
                `• \`lock\` - Kunci info grup (hanya admin yang bisa ubah subjek/ikon)\n` +
                `• \`unlock\` - Buka kunci info grup\n` +
                `• \`approve\` - Aktifkan persetujuan admin untuk gabung\n` +
                `• \`disapprove\` - Nonaktifkan persetujuan admin untuk gabung\n` +
                `• \`invite\` - Izinkan semua anggota menambahkan orang lain\n` +
                `• \`restrict\` - Hanya admin yang bisa menambahkan orang lain\n`;

        case 'fixdb':
        case 'fixdatabase':
            return `*📋 Daftar Kategori FixDB*\n\n` +
                `• \`user\` - Perbaiki skema database pengguna\n` +
                `• \`group\` - Perbaiki skema database grup\n` +
                `• \`menfess\` - Perbaiki skema database pesan rahasia (menfess)\n`;

        default:
            return `List of ${type} (Not fully implemented yet)`;
    }
};

export default {
    get
};
