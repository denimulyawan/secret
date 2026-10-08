/**
 * netinv — penyiapan spreadsheet.
 * =============================================================================
 * Cara pakai:
 *   1. Buka spreadsheet netinv Anda
 *   2. Menu: Extensions → Apps Script
 *   3. Hapus isi berkas yang muncul, tempel SELURUH isi berkas ini
 *   4. Klik Save (ikon disket), lalu pilih fungsi "SIAPKAN" dan klik Run
 *   5. Setujui permintaan izin (dari akun Anda sendiri — skrip ini hanya
 *      menyentuh spreadsheet yang sedang dibuka)
 *   6. Lihat hasilnya di menu View → Logs (atau Execution log)
 *   7. Setelah selesai, HAPUS project Apps Script ini supaya tidak tertinggal
 *
 * Aman dijalankan berulang kali: tab yang sudah ada dan sudah berisi judul
 * TIDAK akan ditimpa, sehingga data yang sudah terisi tidak pernah hilang.
 * =============================================================================
 */

// Susunan tab dan kolom. Harus sama persis dengan yang dibaca aplikasi.
var TABEL = {
  brands: ['brand_code', 'brand_name', 'is_active', 'sort_order', 'created_at'],
  device_types: ['type_code', 'type_name', 'is_active', 'sort_order', 'created_at'],
  cars: ['car_id', 'car_name', 'car_phone', 'notes', 'created_at', 'updated_at', 'version'],
  customers: ['customer_id', 'customer_name', 'car_id', 'notes', 'created_at', 'updated_at', 'version'],
  devices: [
    'device_id', 'asset_category', 'customer_id', 'hostname', 'ip_address', 'url',
    'device_type_code', 'device_model', 'brand_code', 'serial_number',
    'software_version', 'start_license', 'end_license', 'lokasi', 'status',
    'notes', 'created_at', 'created_by', 'updated_at', 'updated_by', 'version'
  ],
  credentials: [
    'credential_id', 'device_id', 'cred_type', 'username', 'secret_enc',
    'key_version', 'port', 'source', 'verified_at', 'notes', 'updated_at', 'updated_by'
  ],
  sites: ['site_code', 'site_name', 'city', 'address', 'notes'],
  audit_log: [
    'ts', 'actor_email', 'action', 'object_type', 'object_id', 'field',
    'result', 'ip', 'user_agent', 'detail'
  ],
  users: [
    'email', 'full_name', 'role', 'is_active', 'created_at', 'created_by',
    'last_login_at', 'version'
  ],
  meta: ['schema_version', 'app_version', 'last_write_at'],
  settings: ['key', 'value_enc', 'is_secret', 'updated_at', 'updated_by'],
  alert_log: [
    'ts', 'device_id', 'license_end', 'threshold_days', 'channel', 'status',
    'error', 'message_id'
  ]
};

// Pilihan dropdown, supaya nilai yang salah ketik tidak bisa masuk.
var PILIHAN = {
  devices: {
    asset_category: ['personal', 'customer'],
    status: ['active', 'maintenance', 'spare', 'retired']
  },
  credentials: {
    cred_type: ['login', 'enable', 'snmp_ro', 'snmp_rw', 'api_token', 'web', 'console', 'other']
  },
  users: {
    role: ['administrator', 'engineer'],
    is_active: ['TRUE', 'FALSE']
  },
  brands: { is_active: ['TRUE', 'FALSE'] },
  device_types: { is_active: ['TRUE', 'FALSE'] },
  settings: { is_secret: ['TRUE', 'FALSE'] }
};

function SIAPKAN() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var laporan = [];
  var dibuat = 0;
  var sudahAda = 0;
  var bermasalah = [];

  Object.keys(TABEL).forEach(function (nama) {
    var headers = TABEL[nama];
    var sheet = ss.getSheetByName(nama);
    var baru = false;

    if (!sheet) {
      sheet = ss.insertSheet(nama);
      baru = true;
      dibuat++;
    } else {
      sudahAda++;
    }

    // Baris 1: judul kolom
    var baris1 = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var terisi = baris1.some(function (v) { return String(v).trim() !== ''; });

    if (!terisi) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#f1f3f5');
      sheet.setFrozenRows(1);
    } else {
      // Sudah ada isinya — periksa saja, JANGAN ditimpa.
      var sekarang = baris1.map(function (v) { return String(v).trim(); });
      var kurang = headers.filter(function (h) { return sekarang.indexOf(h) === -1; });
      if (kurang.length > 0) {
        bermasalah.push(nama + ' — kolom hilang: ' + kurang.join(', '));
      }
    }

    // Lindungi baris judul supaya tidak tersenggol
    try {
      var proteksi = sheet.getRange(1, 1, 1, headers.length).protect();
      proteksi.setDescription('netinv — baris judul, jangan diubah');
      if (!proteksi.canEdit()) {
        proteksi.removeEditor(Session.getEffectiveUser());
      }
    } catch (e) {
      // Kalau sudah pernah dilindungi, lewati saja.
    }

    // Dropdown
    var aturan = PILIHAN[nama];
    if (aturan) {
      Object.keys(aturan).forEach(function (kolom) {
        var posisi = headers.indexOf(kolom);
        if (posisi === -1) return;
        var huruf = kolomKeHuruf(posisi + 1);
        var sel = sheet.getRange(huruf + '2:' + huruf + '1000');
        var rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(aturan[kolom], true)
          .setAllowInvalid(false)
          .setHelpText('Pilih salah satu dari daftar.')
          .build();
        sel.setDataValidation(rule);
      });
    }

    // Lebar kolom secukupnya
    for (var i = 0; i < headers.length; i++) {
      sheet.setColumnWidth(i + 1, 140);
    }

    laporan.push((baru ? '[dibuat]  ' : '[ada]     ') + nama + ' — ' + headers.length + ' kolom');
  });

  // Isi tab meta
  var meta = ss.getSheetByName('meta');
  if (meta && String(meta.getRange('A2').getValue()).trim() === '') {
    meta.getRange('A2:C2').setValues([['1', '0.1.0', new Date().toISOString()]]);
  }

  // Tandai selesai
  laporan.push('');
  laporan.push('Tab dibuat baru : ' + dibuat);
  laporan.push('Tab sudah ada   : ' + sudahAda);
  if (bermasalah.length > 0) {
    laporan.push('');
    laporan.push('PERLU DIPERIKSA:');
    bermasalah.forEach(function (b) { laporan.push('  - ' + b); });
  } else {
    laporan.push('Semua kolom lengkap.');
  }

  var sisa = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (sisa) {
    laporan.push('');
    laporan.push('Catatan: masih ada tab bawaan "' + sisa.getName() + '" yang tidak dipakai.');
    laporan.push('Boleh dihapus manual (klik kanan nama tab → Delete).');
  }

  laporan.push('');
  laporan.push('Langkah berikutnya: hapus project Apps Script ini, lalu bagikan');
  laporan.push('spreadsheet ini ke email akun layanan dengan akses Editor.');

  Logger.log(laporan.join('\n'));
  return laporan.join('\n');
}

/** Memeriksa saja, tanpa mengubah apa pun. */
function PERIKSA() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hasil = [];
  Object.keys(TABEL).forEach(function (nama) {
    var sheet = ss.getSheetByName(nama);
    if (!sheet) { hasil.push('HILANG   : ' + nama); return; }
    var headers = TABEL[nama];
    var baris1 = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
      .map(function (v) { return String(v).trim(); });
    var kurang = headers.filter(function (h) { return baris1.indexOf(h) === -1; });
    hasil.push((kurang.length === 0 ? 'OK       : ' : 'KURANG   : ') + nama +
      (kurang.length ? ' -> ' + kurang.join(', ') : ''));
  });
  var teks = hasil.join('\n');
  Logger.log(teks);
  return teks;
}

function kolomKeHuruf(nomor) {
  var hasil = '';
  while (nomor > 0) {
    var sisa = (nomor - 1) % 26;
    hasil = String.fromCharCode(65 + sisa) + hasil;
    nomor = Math.floor((nomor - 1) / 26);
  }
  return hasil;
}
