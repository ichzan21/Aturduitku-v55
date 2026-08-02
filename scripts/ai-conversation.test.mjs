import assert from "node:assert/strict";
import { buildAiQuestionGuidance, classifyAiQuestion, normalizeAiQuestion } from "../src/aiConversation.js";
import { selectRecentAiMessages } from "../api/_lib/aiMessages.js";

assert.equal(normalizeAiQuestion("gmn cara cek pengeluran di lapran?"), "bagaimana cara cek pengeluaran di laporan?");
assert.equal(classifyAiQuestion("gmn cara pakai amplop?"), "product_help");
assert.equal(classifyAiQuestion("kok login ga bisa?"), "troubleshooting");
assert.equal(classifyAiQuestion("yang sinking fund tadi gimana?"), "follow_up");
assert.match(buildAiQuestionGuidance("saya bingung dan takut karena utang"), /Validasi perasaan/);

const history = Array.from({ length:20 }, (_, index) => ({ role:index % 2 ? "assistant" : "user", content:`pesan-${index}` }));
const selected = selectRecentAiMessages(history, { maxMessages:16, maxChars:18000 });
assert.equal(selected.length, 16);
assert.equal(selected[0].content, "pesan-4");
assert.equal(selected.at(-1).content, "pesan-19");
assert.ok(selectRecentAiMessages([{ role:"system", content:"rahasia" }, { role:"user", content:"halo" }]).every(message => message.role !== "system"));

console.log("AI conversation tests passed");
