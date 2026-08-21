import assert from "node:assert/strict";
import { uiIcon } from "../src/uiIcon.js";

assert.equal(uiIcon("PIN"), "📌", "kode PIN lama harus menjadi ikon pin");
assert.equal(uiIcon("PAY"), "💳", "kode PAY lama harus menjadi ikon pembayaran");
assert.equal(uiIcon("NET"), "🌐", "kode NET lama harus menjadi ikon internet");
assert.equal(uiIcon("CUSTOM_UNKNOWN"), "📌", "kode ikon tak dikenal harus memakai fallback yang aman");
assert.equal(uiIcon("🎬"), "🎬", "emoji pilihan user tidak boleh berubah");
assert.equal(uiIcon(""), "📌", "ikon kosong harus mempunyai fallback");

console.log("UI icon normalization tests passed.");
