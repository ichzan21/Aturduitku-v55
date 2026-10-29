export const reviewBudgets=[
  {id:1,kat:'Makan & Minum',icon:'FOOD',kelas:'Kebutuhan',alokasi:'500000',sub:[{nama:'Camilan',alokasi:'0',emoji:'FOOD'}]},
  {id:2,kat:'Investasi',icon:'INV',kelas:'Investasi',alokasi:'200000',sub:[]},
];
const tx=(id,tipe,jml,extra={})=>({id,tipe,jml,tgl:'2026-10-10',ket:id,dompetId:'cash',...extra});
export const reviewTransactions=[
  tx('outside','pengeluaran','45000',{ket:'Donasi sengaja di luar budget',katId:1,budgetExcluded:true}),
  tx('orphan','pengeluaran','35000',{ket:'Kategori lama terhapus',katId:999,dompetId:'bank'}),
  tx('saving','tabungan','100000',{ket:'Tabungan tanpa kategori',goalId:'goal',dompetId:'bank'}),
  tx('invest','investasi','75000',{ket:'Investasi tanpa kategori',asetId:'asset',dompetId:'bank'}),
  tx('assigned','pengeluaran','10000',{ket:'Belanja sudah masuk budget',katId:'1'}),
  tx('assigned-saving','tabungan','50000',{katId:'2'}),
  tx('goal-spend','pengeluaran','12000',{goalSpendId:'goal'}),
  tx('income','pemasukan','3000000'),
  tx('transfer','transfer','100000',{dompetTo:'bank'}),
  tx('old','pengeluaran','7000',{tgl:'2026-09-30'}),
  tx('legacy-name','pengeluaran','8000',{katId:998,customKat:'Makan & Minum'}),
  tx('legacy-sub','pengeluaran','9000',{katId:998,subKat:'Camilan'}),
];
