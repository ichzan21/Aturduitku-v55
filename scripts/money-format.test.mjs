import assert from "node:assert/strict";
import { formatCompactRupiah } from "../src/moneyFormat.js";

assert.equal(formatCompactRupiah(7500), "Rp 7,5rb", "Rp 7.500 tidak boleh dibulatkan menjadi 8rb");
assert.equal(formatCompactRupiah(10000), "Rp 10rb");
assert.equal(formatCompactRupiah(2500000), "Rp 2,5jt");
assert.equal(formatCompactRupiah(-7500), "-Rp 7,5rb");

console.log("Money format tests passed");
