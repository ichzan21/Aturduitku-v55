const welcome={
  id:"Halo, saya **Dokter Keuangan AI**. Apa yang ingin kamu tinjau hari ini?\n\nKita bisa membahas pengeluaran, budget, atau rencana menabung berdasarkan catatanmu. Analisis saya terbatas pada data yang tersedia.",
  en:"Hi, I'm **Dokter Keuangan AI**. What would you like to review today?\n\nWe can discuss spending, budgets, or a savings plan using your records. My analysis is limited to the data available.",
};
const prompts={
  id:[
    {id:"guide",label:"Mulai mencatat",prompt:"Jelaskan cara memakai AturDuitku dengan data yang belum lengkap."},
    {id:"spending",label:"Tinjau pengeluaran",prompt:"Bagaimana pola pengeluaran saya dari catatan yang tersedia?"},
    {id:"budget",label:"Cek budget",prompt:"Bagaimana pemakaian budget saya bulan ini?"},
    {id:"saving",label:"Rencana menabung",prompt:"Berapa yang realistis untuk saya tabung berdasarkan catatan saya?"},
  ],
  en:[
    {id:"guide",label:"Get started",prompt:"How can I start using AturDuitku with incomplete records?"},
    {id:"spending",label:"Review spending",prompt:"What spending patterns can you see in my available records?"},
    {id:"budget",label:"Check budget",prompt:"How much of my budget have I used this month?"},
    {id:"saving",label:"Plan savings",prompt:"What is a realistic savings contribution based on my records?"},
  ],
};
export const aiWelcome=language=>welcome[language]||welcome.id;
export const aiQuickPrompts=language=>prompts[language]||prompts.id;
