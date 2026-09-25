import assert from "node:assert/strict";
import { uiIcon } from "../src/uiIcon.js";
import { findWalletBrand, walletFallbackIcon } from "../src/walletBrand.js";

assert.equal(uiIcon("PIN"), "📌", "kode PIN lama harus menjadi ikon pin");
assert.equal(uiIcon("PAY"), "💳", "kode PAY lama harus menjadi ikon pembayaran");
assert.equal(uiIcon("NET"), "🌐", "kode NET lama harus menjadi ikon internet");
assert.equal(uiIcon("CUSTOM_UNKNOWN"), "📌", "kode ikon tak dikenal harus memakai fallback yang aman");
assert.equal(uiIcon("🎬"), "🎬", "emoji pilihan user tidak boleh berubah");
assert.equal(uiIcon(""), "📌", "ikon kosong harus mempunyai fallback");

assert.equal(findWalletBrand("Tabungan BCA")?.key, "bca", "nama dompet BCA harus memakai logo BCA");
assert.equal(findWalletBrand({ nama:"Bank BNI Bisnis" })?.key, "bni", "nama dompet BNI harus memakai logo BNI");
assert.equal(findWalletBrand("Shopee Pay")?.key, "shopeepay", "variasi nama ShopeePay harus dikenali");
assert.equal(findWalletBrand({ nama:"Dana belanja", tipe:"E-Wallet" })?.key, "dana", "nama e-wallet DANA harus dikenali sebagai merek");
assert.equal(findWalletBrand({ nama:"Dana darurat", tipe:"Bank" }), null, "kata dana umum tidak boleh dianggap sebagai merek DANA");
assert.equal(findWalletBrand("Kas operasional"), null, "nama dompet umum tidak boleh diberi logo merek");
assert.equal(walletFallbackIcon({ tipe:"Tunai" }), "CASH", "dompet tunai harus memakai fallback uang tunai");
assert.equal(walletFallbackIcon({ tipe:"E-Wallet" }), "PAY", "e-wallet umum harus memakai fallback pembayaran");

console.log("UI icon and wallet brand tests passed.");
