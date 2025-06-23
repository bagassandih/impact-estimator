const messages = {
  id: {
    impactTitle: '📦 Estimasi Dampak',
    file: 'File',
    lastChangedBy: 'Terakhir diubah oleh',
    lastChangedTime: 'Waktu',
    scannedFiles: 'File yang dipindai',
    usageDetail: 'Detail Penggunaan',
    notFound: 'Tidak ditemukan pemanggilan',
    note: 'Catatan',
    riskLevelLow: '✅ Tingkat Risiko: RENDAH',
    riskLowMessage: 'File ini sepertinya aman untuk diubah karena tidak ada dependensi yang terdeteksi.',
    riskLevelMedium: '⚠️ Tingkat Risiko: SEDANG',
    riskMediumMessage: n => `Ada ${n} file yang terpengaruh. Pastikan untuk menguji perubahan dengan baik.`,
    riskLevelHigh: '🚨 Tingkat Risiko: TINGGI',
    riskHighMessage: n => `Ada ${n} file yang terpengaruh. Lakukan testing menyeluruh!`,
    notAGitRepo: 'Bukan repository Git',
    noCommit: 'Belum ada commit untuk file ini',
    warning: (func) => `⚠️ **Peringatan:** Fungsi \`${func}\` tidak ditemukan. Kemungkinan:\n- Nama fungsi tidak persis sama\n- Fungsi hanya digunakan secara internal\n- Fungsi belum dipakai di proyek ini`,
    functionFound: (func, n) => `Fungsi \`${func}()\` ditemukan di **${n}** file`,
    analysisInProgress: "Menganalisis dampak perubahan...",
    scanningFiles: "Memindai file...",
    displayingResult: "Menampilkan hasil...",
    analysisDone: "Analisis selesai!",
    analysisError: "Error saat menjalankan analisis",
    analysisFailed: "Gagal menjalankan analisis",
    noFileOpen: "Tidak ada file yang sedang dibuka.",
    noWorkspace: "File harus berada dalam workspace folder.",
    startMessage: 'Klik kanan pada file dan pilih "Impact Estimator" untuk memulai analisis.',
    panelLoadFailed: "Gagal memuat panel Impact Estimator"
  },
  en: {
    impactTitle: '📦 Impact Estimation',
    file: 'File',
    lastChangedBy: 'Last changed by',
    lastChangedTime: 'Time',
    scannedFiles: 'Scanned files',
    usageDetail: 'Usage Details',
    notFound: 'No usage found',
    note: 'Note',
    riskLevelLow: '✅ Risk Level: LOW',
    riskLowMessage: 'This file appears safe to change as no dependencies were detected.',
    riskLevelMedium: '⚠️ Risk Level: MEDIUM',
    riskMediumMessage: n => `${n} files are affected. Be sure to test your changes carefully.`,
    riskLevelHigh: '🚨 Risk Level: HIGH',
    riskHighMessage: n => `${n} files are affected. Extensive testing recommended!`,
    notAGitRepo: 'Not a Git repository',
    noCommit: 'No commits yet for this file',
    warning: (func) => `⚠️ **Warning:** Function \`${func}\` was not found. Possible reasons:\n- The function name is not exactly the same\n- The function is used only internally\n- The function is not used in this project`,
    functionFound: (func, n) => `Function \`${func}()\` was found in **${n}** files`,
    analysisInProgress: "Analyzing impact...",
    scanningFiles: "Scanning files...",
    displayingResult: "Displaying results...",
    analysisDone: "Analysis complete!",
    analysisError: "Error during analysis",
    analysisFailed: "Failed to run analysis",
    noFileOpen: "No file is currently open.",
    noWorkspace: "File must be inside a workspace folder.",
    startMessage: 'Right-click on a file and choose "Impact Estimator" to start analysis.',
    panelLoadFailed: "Failed to load Impact Estimator panel"
  }
};

function t(key, lang, ...args) {
  const langMap = messages[lang] || messages.id;
  const value = langMap[key];
  return typeof value === 'function' ? value(...args) : value || key;
}

module.exports = {
  t,
  id: messages.id,
  en: messages.en
};
