const typoRules = [
  [/\b(gmn|gmna|bgmn|bgmna)\b/gi, "bagaimana"],
  [/\b(knp|kenap)\b/gi, "kenapa"],
  [/\b(ga|gak|nggak|enggak|tdk)\b/gi, "tidak"],
  [/\b(sy|sya)\b/gi, "saya"],
  [/\b(udh|udah)\b/gi, "sudah"],
  [/\b(blm)\b/gi, "belum"],
  [/\b(pemasukn|pemasukkan)\b/gi, "pemasukan"],
  [/\b(pengeluran|pengluaran)\b/gi, "pengeluaran"],
  [/\b(budjet|buget)\b/gi, "budget"],
  [/\b(dompt)\b/gi, "dompet"],
  [/\b(laporn|lapran)\b/gi, "laporan"],
];

export const normalizeAiQuestion = value => typoRules.reduce(
  (text, [pattern, replacement]) => text.replace(pattern, replacement),
  String(value || "").toLowerCase().replace(/\s+/g, " ").trim(),
);

export const classifyAiQuestion = value => {
  const text = normalizeAiQuestion(value);
  if (!text) return "clarification";
  if (/\b(error|gagal|tidak bisa|hilang|lambat|loading|login|approval|sinkron|bug)\b/.test(text)) return "troubleshooting";
  if (/\b(tadi|yang itu|sebelumnya|lanjut|maksudnya)\b/.test(text)) return "follow_up";
  if (/\b(sedih|takut|cemas|panik|bingung|stres|stress|malu|capek)\b/.test(text)) return "emotional_finance";
  if (/\b(hitung|berapa|target|rencana|strategi|solusi|saran|analisis|kondisi)\b/.test(text)) return "financial_solution";
  if (/\b(cara pakai|cara menggunakan|fitur|menu|aturduitku|dompet|budget|amplop|goal|habit|aset|utang|laporan|transaksi)\b/.test(text)) return "product_help";
  return text.split(" ").length < 3 ? "clarification" : "general_question";
};

const guidanceByMode = {
  troubleshooting:"Pahami gejala teknisnya, berikan pemeriksaan paling sederhana terlebih dahulu, lalu arahkan ke bantuan admin hanya jika langkah mandiri tidak cukup. Jangan mengarang penyebab.",
  product_help:"Jawab sebagai ahli produk AturDuitku: jelaskan fungsi, lokasi menu, langkah penggunaan, hasil yang akan terlihat, dan kesalahan umum yang perlu dihindari.",
  follow_up:"Gunakan konteks percakapan sebelumnya. Jangan mengatakan topiknya tidak ditemukan jika rujukannya masih dapat disimpulkan; sebutkan interpretasimu secara singkat sebelum melanjutkan.",
  emotional_finance:"Validasi perasaan user dalam satu kalimat, hindari menghakimi, lalu pecah masalah menjadi satu tindakan kecil hari ini dan rencana lanjutan yang realistis.",
  financial_solution:"Berikan diagnosis singkat, angka/perhitungan bila datanya tersedia, solusi utama, alternatif, serta satu langkah yang bisa dilakukan hari ini.",
  clarification:"Jika maksud paling mungkin dapat dipahami, jawab berdasarkan interpretasi itu dan sebutkan asumsi singkat. Jika ada dua arti yang sama kuat, ajukan hanya satu pertanyaan klarifikasi yang spesifik.",
  general_question:"Jawab inti pertanyaan terlebih dahulu, lalu beri penjelasan dan contoh praktis. Bila pertanyaan di luar keuangan, tetap bantu secara ringkas selama aman dan tidak mengarang informasi terbaru.",
};

export const buildAiQuestionGuidance = value => {
  const mode = classifyAiQuestion(value);
  return `Mode pesan terbaru: ${mode}. ${guidanceByMode[mode]}`;
};

export const buildAiFallbackAnswer = value => {
  const mode = classifyAiQuestion(value);
  if (mode === "troubleshooting") return "Aku menangkap ada kendala di aplikasi. Sebutkan menu yang dibuka, tombol yang ditekan, dan pesan error yang terlihat agar aku bisa memberi langkah pemeriksaan yang tepat.";
  if (mode === "product_help") return "Aku siap memandu fitur AturDuitku langkah demi langkah. Sebutkan menu yang ingin dipakai dan tujuanmu, misalnya mencatat pemasukan, membuat budget, atau menyiapkan dana di Amplop.";
  return "Aku ingin memastikan solusinya tepat. Bisa ceritakan sedikit lagi tujuanmu dan bagian mana yang paling membingungkan?";
};
