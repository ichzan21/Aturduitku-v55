import React from "react";
import {
  BadgeDollarSign, Banknote, BookOpen, BriefcaseBusiness, CarFront,
  ChartNoAxesCombined, CircleDollarSign, CircleGauge, CircleHelp, Coffee,
  CreditCard, Dumbbell, Gamepad2, Gift, GraduationCap, HandCoins, HeartPulse,
  House, Landmark, Lightbulb, Mail, MapPin, Music2, Package, Plane, ReceiptText, RefreshCcw, Settings,
  ShieldCheck, Shirt, ShoppingBag, Smartphone, Sprout, Target, TrendingDown,
  TrendingUp, Utensils, WalletCards, Wifi,
} from "lucide-react";
import { findWalletBrand, walletFallbackIcon } from "./walletBrand.js";

const ICON_COMPONENTS = {
  BANK:Landmark, PAY:CreditCard, CASH:Banknote, NET:Wifi,
  FOOD:Utensils, FOD:Utensils, MOVE:CarFront, MOV:CarFront, TRANSPORT:CarFront,
  BILL:ReceiptText, HEAL:HeartPulse, HLT:HeartPulse, HEALTH:HeartPulse,
  SHOP:ShoppingBag, SHP:ShoppingBag, SHOPPING:ShoppingBag,
  FUN:Gamepad2, EDU:GraduationCap, EDUCATION:GraduationCap,
  INV:ChartNoAxesCombined, ETC:Package, ENV:Mail, ENVELOPE:Mail,
  IDEA:Lightbulb, TRP:Plane, AIRPLANE:Plane, PLANE:Plane, TRAVEL:Plane,
  HOME:House, STYL:Shirt, WORK:BriefcaseBusiness, MUS:Music2,
  CAFE:Coffee, GIFT:Gift, FIT:Dumbbell, PLNT:Sprout, STDY:BookOpen,
  PHN:Smartphone, CARE:HeartPulse, PIN:MapPin,
  GOAL:Target, ASSET:BadgeDollarSign, DEBT:HandCoins, ADM:ShieldCheck,
  HM:House, WL:WalletCards, TX:ReceiptText, BG:CircleGauge, GL:Target,
  AS:BadgeDollarSign, UT:HandCoins, RP:TrendingUp, ST:Settings,
  home:House, dompet:WalletCards, trans:ReceiptText, budget:CircleGauge,
  amplop:Mail, goals:Target, habit:CircleGauge, aset:BadgeDollarSign,
  utang:HandCoins, laporan:TrendingUp, setting:Settings, admin:ShieldCheck,
  transfer:RefreshCcw, income:TrendingUp, expense:TrendingDown,
  refund:RefreshCcw, receivable:HandCoins, balance:CircleDollarSign,
};

const normalizeIconKey = icon => String(icon || "").trim();

export function AppIcon({ icon, size=20, strokeWidth=2, title, style, ...props }) {
  const raw = normalizeIconKey(icon);
  const Icon = ICON_COMPONENTS[raw] || ICON_COMPONENTS[raw.toUpperCase()];
  if (Icon) return <Icon aria-hidden={title ? undefined : true} aria-label={title} size={size} strokeWidth={strokeWidth} style={{display:"block",...style}} {...props}/>;

  if (raw && !/^[A-Z][A-Z0-9_-]{1,20}$/.test(raw)) {
    return <span aria-label={title} role={title ? "img" : undefined} style={{fontSize:size,lineHeight:1,display:"inline-flex",alignItems:"center",justifyContent:"center",...style}} {...props}>{raw}</span>;
  }

  return <CircleHelp aria-hidden={title ? undefined : true} aria-label={title} size={size} strokeWidth={strokeWidth} style={{display:"block",...style}} {...props}/>;
}

export function WalletIcon({ wallet, size=40, style, imageStyle, title }) {
  const brand = findWalletBrand(wallet);
  const label = title || brand?.label || wallet?.nama || wallet?.tipe || "Dompet";
  const frameStyle = {
    width:size,
    height:size,
    minWidth:size,
    borderRadius:Math.max(8, Math.round(size * .24)),
    background:"#FFFFFF",
    border:"1px solid rgba(148, 163, 184, .24)",
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    overflow:"hidden",
    flexShrink:0,
    ...style,
  };

  return (
    <span title={label} aria-label={label} role="img" style={frameStyle}>
      {brand
        ? <img src={brand.src} alt="" width={size} height={size} loading="lazy" decoding="async" style={{width:"100%",height:"100%",objectFit:"contain",padding:Math.max(4,Math.round(size*.13)),boxSizing:"border-box",...imageStyle}}/>
        : <AppIcon icon={walletFallbackIcon(wallet)} size={Math.round(size*.5)} strokeWidth={2.1}/>
      }
    </span>
  );
}
