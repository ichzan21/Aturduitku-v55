import assert from "node:assert/strict";
import { formatCompactRupiah } from "../src/moneyFormat.js";

assert.equal(formatCompactRupiah(7500), "Rp 7,5rb", "Rp 7.500 tidak boleh dibulatkan menjadi 8rb");
assert.equal(formatCompactRupiah(10000), "Rp 10rb");
assert.equal(formatCompactRupiah(2500000), "Rp 2,5jt");
assert.equal(formatCompactRupiah(-7500), "-Rp 7,5rb");
assert.equal(formatCompactRupiah(Number.NaN), "Rp 0");

const source = await (await import("node:fs/promises")).readFile("src/App.jsx", "utf8");
assert.match(source, /const idrs = formatCompactRupiah;/, "Export PDF harus memakai formatter presisi");
assert.doesNotMatch(source, /\(a\/1e3\)\.toFixed\(0\)\+"rb"/, "Tidak boleh ada pembulatan rb lama di tampilan");

console.log("Money format tests passed");
