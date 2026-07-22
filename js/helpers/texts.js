/**
 * =================================================================================
 * FILE         : /js/helpers/texts.js
 * FILE VERSION : 2.0.1-rev1
 * APP VERSION  : 2.0.1
 * DATE         : 1 Juli 2026
 * @author      : gk
 *
 * CHANGELOG  :
 *
 * =================================================================================
 */

'use strict';

// ==================== VERSI FILE ====================
const F_V = '2.0.1-rev1';

// =============================================================================
// 1. RANDOM_QUOTES (3 Kategori)
// =============================================================================

const RANDOM_QUOTES = {
    driver: [
        ['Driver sejahtera', 'sistem ketar-ketir'],
        ['Transparansi menang', 'driver pun senang'],
        ['Kalkulasi akurat', 'hasil berpihak ke driver'],
        ['Sistem boleh canggih', 'driver tetap raja'],
        ['Hitung sendiri', 'baru tau siapa yang untung']
    ],
    app: [
        ['Sistem makin kaya', 'driver makin nelangsa'],
        ['Komisi melambung', 'driver menanggung'],
        ['Di atas kertas untung', 'kenyataan buntung'],
        ['Sistem penuh rahasia', 'driver penuh tanda tanya'],
        ['Transparansi?', 'Sistem: "Nanti dulu..."']
    ],
    neutral: [
        ['Tarif transparan', 'driver sejahtera'],
        ['Hitung sebelum jalan', 'jangan sampai boncos'],
        ['Kupas tuntas', 'tarif ojek online'],
        ['Biar sistem yang hitung', 'kamu tinggal narik'],
        ['Hitung dulu baru jalan', 'biar nggak nyesel']
    ]
};

// =============================================================================
// 2. SARCASM_CATEGORIES (6 kategori x 3-5 teks)
// =============================================================================

const SARCASM_CATEGORIES = {
    minus: {
        name: 'Minus',
        condition: (driver, app) => driver < 0,
        texts: [
            'Driver bayar aplikasi?',
            'Minus? Siapa yang kerja?',
            'Rugi bandar, lanjutkan!',
            'Kerja keras, hasil minus?',
            'Ini mah bukan kerja, ini sedekah!'
        ]
    },
    sedekah: {
        name: 'Sedekah',
        condition: (driver, app) => app > driver * 2,
        texts: [
            'Aplikasi terbang tinggi!',
            'Driver sedekah ke aplikasi',
            'Aplikasi makin kaya, driver makin...',
            'Komisi gede, driver lelah'
        ]
    },
    serakah: {
        name: 'Serakah',
        condition: (driver, app) => app > driver,
        texts: [
            'Aplikasi lebih untung',
            'Sistem terlalu rakus',
            'Komisi gede, driver lelah',
            'Aplikasi senyum, driver nangis'
        ]
    },
    ajaib: {
        name: 'Ajaib',
        condition: (driver, app) => driver > app * 1.5,
        texts: [
            'Driver juaranya!',
            'Mantap! Driver unggul jauh',
            'Ajaib! Driver menang telak',
            'Ini baru driver sejati!'
        ]
    },
    biasa: {
        name: 'Biasa',
        condition: (driver, app) => driver > app,
        texts: [
            'Driver unggul, lumayan',
            'Alhamdulillah, driver menang',
            'Lumayan, driver dapat lebih',
            'Masih mending driver'
        ]
    },
    imbang: {
        name: 'Imbang',
        condition: (driver, app) => driver === app,
        texts: [
            'Imbang, bagi rata',
            'Sama rata, sama rasa',
            'Bagi dua, adil!',
            'Fifty-fifty, fair!'
        ]
    }
};

// =============================================================================
// 3. OPENHELP_CONTENT
// =============================================================================

const OPENHELP_CONTENT = {
    default: {
        title: 'Bantuan',
        content: 'Tidak ada informasi untuk topik ini.'
    },
    'home-battle': {
        title: 'Klasemen Sementara',
        content: 'Perbandingan total pendapatan Driver vs Aplikasi dari seluruh riwayat. Tebak siapa juaranya?.'
    },
    'order-omset': {
        title: 'OMSET DRIVER',
        content: 'Pendapatan kotor driver (sebelum dipotong biaya operasional) yang sudah dipotong komisi aplikasi.'
    },
    'order-harga': {
        title: 'HARGA PENUMPANG',
        content: 'Total yang dibayarkan penumpang. Terdiri dari tarif perjalanan + biaya aplikasi.'
    },
    'order-jarak': {
        title: 'JARAK ANTAR',
        content: 'Estimasi jarak pengantaran (km). Biasanya sih diumpetin, disuruh masuk dulu kucingnya ke dalam karung.'
    },
    'order-kenaikan': {
        title: 'KENAIKAN TARIF',
        content: 'Persentase kenaikan tarif jika jarak disembunyikan aplikasi. Isi dalam persen (0-1000%).'
    },
    'order-layanan': {
        title: 'TIPE LAYANAN',
        content: 'Jenis layanan yang dipilih. Mempengaruhi tarif dasar dan biaya aplikasi.\n' +
                 '\n' +
                 'HEMAT: bayar murah, pendapatan rendah, nyari drivernya susah.' +
                 '\n' +
                 'STANDAR: orderan biasa, biasanya jauh dan biasanya murah.' +
                 '\n' +
                 'XL: ukurannya lebih gede, kendaraan lebih mahal, tarifnya gedena dikit.' +
                 '\n' +
                 'PRIORITAS: karena yg lain harus jauh jemputnya, jadi bisa dijual terpisah.' +
                 '\n' +
                 'PREMIUM: serupa tapi tidak sama dengan taxi.\n' +
                 '\n' +
                 'Setiap layanan memiliki biaya jaminan pendapatan minimum kepada aplikasi yg berbeda. Tidak mempengaruhi pendapatan driver.' +
                 '\n'
    },
    'order-estimasi-jarak': {
        title: 'ESTIMASI JARAK (OFFLINE)',
        content: 'Perkiraan jarak antar perjalanan dalam kilometer (km).'
    },
    'order-estimasi-waktu': {
        title: 'ESTIMASI WAKTU (OFFLINE)',
        content: 'Perkiraan waktu antar perjalanan dalam menit (mnt).'
    },
    'order-tariff-type': {
        title: 'TIPE TARIF OFFLINE',
        content: 'Wajar: tarif sesuai kebutuhan hidup. Minimal: tarif dari pemerintah. Abnormal: tarif yg dikasih aplikasi kepada driver. App: samain dengan tarif di aplikasi tapi tanpa potongan.'
    },
    'reality-biaya-rahasia': {
        title: 'BIAYA RAHASIA',
        content: 'Jaminan pendapatan minimum per order bagi aplikasi, apapun yg terjadi.'
    },
    'reality-jemput': {
        title: 'PENJEMPUTAN',
        content: 'Jarak dan waktu aktual penjemputan. Untuk penumpang: nilai ini otomatis terisi maksimal gratis.'
    },
    'reality-antar': {
        title: 'PENGANTARAN',
        content: 'Jarak dan waktu aktual pengantaran.'
    },
    'tracking-status': {
        title: 'STATUS TRACKING',
        content: 'Idle: belum mulai. Pickup: menuju penjemputan. Dropoff: menuju tujuan. Paused: dijeda.'
    },
    'tracking-live': {
        title: 'LIVE INCOME',
        content: 'Estimasi pendapatan/biaya yang diperbarui setiap 0.1 km atau 1 menit selama tracking.'
    },
    'report-keuangan': {
        title: 'PEMBAGIAN KEUANGAN',
        content: 'Persentase pembagian pendapatan antara Driver, Aplikasi, dan Operasional. Penumpang sebagai pembanding (100%).'
    },
    'report-target': {
        title: 'TARGET BULANAN',
        content: 'Target pendapatan per bulan berdasarkan klaim aplikasi. Tanpa dihitung waktu jeda dan istirahat.'
    },
    'report-proyeksi': {
        title: 'PROYEKSI',
        content: 'Proyeksi pendapatan jika bekerja 4 jam, 8 jam, atau 12 jam per hari.'
    },
    'report-pendapatan': {
        title: 'INFO PENDAPATAN',
        content: 'Rincian pendapatan driver dan aplikasi.'
    },
    'report-pesanan': {
        title: 'INFO PESANAN',
        content: 'Informasi jarak dan waktu penjemputan dan pengantaran.'
    },
    'report-segmen': {
        title: 'RINCIAN SEGMEN',
        content: 'Rincian biaya per segmen perjalanan (penjemputan dan pengantaran).'
    },
    'history-stats': {
        title: 'STATISTIK',
        content: 'Akumulasi pendapatan dari riwayat yang sudah difilter.'
    },
    'history-filter': {
        title: 'FILTER',
        content: 'Filter riwayat berdasarkan mode kendaraan dan switch operasional.'
    },
    'maintenance-jarak': {
        title: 'TOTAL JARAK',
        content: 'Akumulasi jarak semua perjalanan yang sudah tercatat di riwayat.'
    },
    'maintenance-waktu': {
        title: 'TOTAL WAKTU',
        content: 'Akumulasi waktu semua perjalanan yang sudah tercatat di riwayat.'
    },
    'maintenance-kesejahteraan': {
        title: 'KESEJAHTERAAN DRIVER',
        content: 'Dana kesejahteraan driver yang dipotong oleh aplikasi (5% dari tarif). Lihat rincian di laporan.'
    },
    'maintenance-bbm': {
        title: 'BBM (TOTAL LITER)',
        content: 'Estimasi total konsumsi BBM berdasarkan biaya BBM yang tercatat di riwayat.'
    },
    'maintenance-perawatan': {
        title: 'PERAWATAN',
        content: 'Biaya perawatan kendaraan berdasarkan interval km. Progress dihitung dari total jarak tempuh.'
    },
    'maintenance-atribut': {
        title: 'ATRIBUT / KESP',
        content: 'Biaya atribut driver seperti seragam, helm, jas hujan.'
    },
    'maintenance-pajak': {
        title: 'PAJAK',
        content: 'Biaya pajak tahunan dan 5 tahunan kendaraan.'
    },
    'maintenance-penyusutan': {
        title: 'PENYUSUTAN',
        content: 'Estimasi penyusutan nilai kendaraan berdasarkan selisih harga beli dan jual.'
    },
    'settings-quick-order': {
        title: 'ORDER CEPAT',
        content: 'Lewati popup pemilihan peran. Klik kartu kendaraan di Home langsung menuju Order.'
    },
    'settings-always-gps': {
        title: 'SELALU GPS',
        content: 'Dari Order langsung menuju Tracking tanpa ke Reality terlebih dahulu.'
    },
    'settings-offline': {
        title: 'MODE OFFLINE',
        content: 'Aktifkan tombol Order Offline di popup Home.'
    },
    'settings-operational': {
        title: 'ALWAYS OPERATIONAL',
        content: 'Abaikan peran Driver/Penumpang. Langsung menuju Tracking mode Operasional (biaya murni kendaraan).'
    },
    'settings-large-text': {
        title: 'TEKS LEBIH BESAR',
        content: 'Perbesar ukuran teks di seluruh aplikasi.'
    },
    'order-estimasi': {
        title: 'ESTIMASI',
        content: 'Hasil estimasi tarif berdasarkan input order. Menampilkan jarak, waktu, tarif per km/menit, serta estimasi pendapatan driver dan aplikasi.'
    },
    'settings-template': {
        title: 'CUSTOM COPY TEMPLATE',
        content: 'Template untuk fitur Copy Preview di halaman Order. Gunakan placeholder yang tersedia. Klik placeholder untuk menyisipkan.'
    }
};

// =============================================================================
// 4. POPUP_TEXTS
// =============================================================================

const POPUP_TEXTS = {
    1: {
        title: 'Informasi',
        message: 'Tidak ada informasi tambahan.',
        buttons: [
            { text: 'MENGERTI', action: 'confirm' }
        ]
    },
    2: {
        title: 'Bantuan',
        message: 'Informasi bantuan tidak tersedia.',
        buttons: [
            { text: 'MENGERTI', action: 'confirm' }
        ]
    },
    3: {
        title: 'Info',
        message: '',
        buttons: [
            { text: 'OK', action: 'confirm' }
        ]
    },
    4: {
        title: 'Info',
        message: '',
        buttons: [
            { text: 'OK', action: 'confirm' }
        ]
    },
    5: {
        title: 'Info',
        message: '',
        buttons: [
            { text: 'OK', action: 'confirm' }
        ]
    },
    6: {
        title: 'KONFIRMASI HAPUS',
        message: 'Data yang dihapus tidak dapat dikembalikan. Lanjutkan?',
        buttons: [
            { text: 'BATAL', action: 'cancel' },
            { text: 'YA', action: 'confirm' }
        ]
    },
    7: {
        title: 'RESET PENGATURAN',
        message: 'Semua pengaturan akan dikembalikan ke default. Lanjutkan?',
        buttons: [
            { text: 'BATAL', action: 'cancel' },
            { text: 'YA', action: 'confirm' }
        ]
    },
    8: {
        title: 'HAPUS SEMUA RIWAYAT',
        message: 'Semua riwayat perjalanan akan dihapus permanen. Lanjutkan?',
        buttons: [
            { text: 'BATAL', action: 'cancel' },
            { text: 'YA', action: 'confirm' }
        ]
    },
    9: {
        title: 'Konfirmasi',
        message: 'Apakah Anda yakin?',
        buttons: [
            { text: 'BATAL', action: 'cancel' },
            { text: 'YA', action: 'confirm' }
        ]
    }
};

// =============================================================================
// 5. REPORT_NOTES
// =============================================================================

const REPORT_NOTES = [
    { type: 'umum', text: 'HIDUP adalah syarat utama untuk melakukan semua aktifitas ini' },
    { type: 'umum', text: 'Tidak termasuk biaya hidup seperti: makan, ongkos ngider, beli kendaraan, biaya server, bayar kontrakan dan gaji pegawai' },
    { type: 'umum', text: 'Tidak termasuk biaya non perjalanan order seperti: ban bocor, nunggu order dikasih, cicilan pinjaman, asuransi, marketing, tilang dan suap oknum' },
    { type: 'umum', text: 'Tidak termasuk bonus seperti: diskon, insentif, gaji ke 13 atau trip plesiran karena target KPI tercapai' },
    { type: 'umum', text: 'Penjemputan tidak masuk ke dalam tarif atau pendapatan' },
    { type: 'umum', text: 'UMR Jakarta (5 hari 8 jam kerja) adalah Rp. 578/menit' },
    { type: 'mobil', text: 'Biaya operasional mobil 1000cc ketika diam macet parah adalah Rp. 198/mnt' },
    { type: 'motor', text: 'Biaya operasional motor 125cc ketika diam macet parah adalah Rp. 46/mnt' },
    { type: 'mobil listrik', text: 'Biaya operasional mobil listrik ketika diam macet parah adalah Rp. 170/mnt' },
    { type: 'motor listrik', text: 'Biaya operasional motor listrik ketika diam macet parah adalah Rp. 22/mnt' },
    { type: 'mobil listrik', text: 'Data perawatan dan penyusutan kendaraan listrik masih menggunakan kendaraan bensin' },
    { type: 'motor listrik', text: 'Data perawatan dan penyusutan kendaraan listrik masih menggunakan kendaraan bensin' },
    { type: 'mobil listrik', text: 'Biaya listrik sudah disesuaikan dengan biaya per kWh dan biaya admin penjualan' },
    { type: 'motor listrik', text: 'Biaya listrik sudah disesuaikan dengan biaya per kWh dan biaya admin penjualan' }
];

// =============================================================================
// 6. FUNGSI HELPER
// =============================================================================

function getRandomQuote(stats = {}) {
    let category;
    if (!stats.totalMatch || stats.totalMatch === 0) {
        category = 'neutral';
    } else if (stats.driverPercent > stats.appPercent) {
        category = 'driver';
    } else if (stats.appPercent > stats.driverPercent) {
        category = 'app';
    } else {
        category = 'neutral';
    }

    const quotes = RANDOM_QUOTES[category] || RANDOM_QUOTES.neutral;
    return quotes[Math.floor(Math.random() * quotes.length)];
}

function getOpenHelp(key) {
    return OPENHELP_CONTENT[key] || OPENHELP_CONTENT['default'];
}

function getSarcasm(driverIncome, appIncome) {
    for (const key in SARCASM_CATEGORIES) {
        if (SARCASM_CATEGORIES.hasOwnProperty(key)) {
            const category = SARCASM_CATEGORIES[key];
            if (category.condition(driverIncome, appIncome)) {
                const texts = category.texts;
                return texts[Math.floor(Math.random() * texts.length)];
            }
        }
    }
    return 'Hitung-hitungan selesai!';
}

// =============================================================================
// 7. EKSPOR
// =============================================================================

export const Texts = {
    RANDOM_QUOTES,
    SARCASM_CATEGORIES,
    OPENHELP_CONTENT,
    POPUP_TEXTS,
    REPORT_NOTES,

    getRandomQuote,
    getOpenHelp,
    getSarcasm
};

window.log.info('[Texts ' + F_V + '] Texts dimuat (rev1: pemangkasan ikon & pesan)');


// ================================ End Of File ================================