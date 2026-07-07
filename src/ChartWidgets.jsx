import React from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

export const TrendChart = ({ trendData, isMobile, T, idrs }) => {
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background:T.card, border:`1.5px solid ${T.border}`, borderRadius:10, padding:"10px 14px", fontSize:12, boxShadow:T.shadowMd }}>
        <div style={{ fontWeight:700, color:T.text, marginBottom:6 }}>{label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color:p.color, marginBottom:3 }}>{p.name}: {idrs(p.value)}</div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
      <AreaChart data={trendData} margin={{ top:5, right:5, bottom:0, left:0 }}>
        <defs>
          <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#22C55E" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gSave" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} vertical={false}/>
        <XAxis dataKey="label" tick={{ fontSize:10, fill:T.muted }} axisLine={false} tickLine={false}/>
        <YAxis tickFormatter={v => idrs(v)} tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false} width={50}/>
        <Tooltip content={<CustomTooltip/>}/>
        <Area type="monotone" dataKey="masuk" name="Pemasukan" stroke="#22C55E" strokeWidth={2} fill="url(#gIn)" dot={false}/>
        <Area type="monotone" dataKey="keluar" name="Pengeluaran" stroke="#EF4444" strokeWidth={2} fill="url(#gOut)" dot={false}/>
        <Area type="monotone" dataKey="tabung" name="Tabungan" stroke="#6366F1" strokeWidth={2} fill="url(#gSave)" dot={false}/>
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const DailyChart = ({ txBulan, bulan, tahun, months, T, idr, n, isMobile=false }) => {
  const now = new Date();
  const isCurrentMonth = months[now.getMonth()] === bulan && now.getFullYear() === Number(tahun);
  const mIdx = months.indexOf(bulan);
  const yr = Number(tahun);
  const daysInMonth = new Date(yr, mIdx + 1, 0).getDate();
  const data = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${yr}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const val = txBulan.filter(t => t.tipe === "pengeluaran" && t.tgl === key).reduce((a, b) => a + n(b.jml), 0);
    data.push({ d:String(d), val });
  }
  const todayNum = isCurrentMonth ? now.getDate() : -1;

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 180 : 130}>
      <BarChart data={data} margin={isMobile ? { top:10, right:4, bottom:2, left:4 } : { top:4, right:4, bottom:0, left:0 }}>
        <XAxis dataKey="d" interval={isMobile ? 4 : 2} tick={{ fontSize:9, fill:T.muted }} axisLine={false} tickLine={false}/>
        <Tooltip
          cursor={false}
          wrapperStyle={isMobile ? { display:"none" } : undefined}
          formatter={v => idr(v)}
          labelFormatter={l => `Tgl ${l}`}
          contentStyle={{ borderRadius:8, fontSize:11, background:T.card, border:`1px solid ${T.border}`, color:T.text }}
        />
        <Bar dataKey="val" radius={[4, 4, 0, 0]} barSize={isMobile ? 8 : undefined}>
          {data.map((entry, i) => (
            <Cell key={i} fill={i + 1 === todayNum ? "#8B5CF6" : entry.val > 0 ? "#6366F1" : T.borderLight}/>
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const DonutChart = ({ pieData, pieColors, T, idr, height=160, outerRadius=64, innerRadius=34, showLabel=false, isMobile=false }) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie
        data={pieData}
        dataKey="value"
        cx="50%"
        cy="50%"
        outerRadius={outerRadius}
        innerRadius={innerRadius}
        label={showLabel && !isMobile ? ({ percent }) => `${(percent * 100).toFixed(0)}%` : false}
        labelLine={false}
        stroke={T.card}
        strokeWidth={2}
      >
        {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]}/>)}
      </Pie>
      {showLabel && isMobile && pieData.length === 1 && (
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={T.text} fontSize="18" fontWeight="800">100%</text>
      )}
      <Tooltip formatter={v => idr(v)} contentStyle={{ borderRadius:8, fontSize:12, background:T.card, border:`1px solid ${T.border}`, color:T.text }}/>
    </PieChart>
  </ResponsiveContainer>
);
