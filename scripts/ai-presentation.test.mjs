import assert from 'node:assert/strict';
import {aiWelcome,aiQuickPrompts,aiResponseInstruction} from '../src/aiPresentation.js';
import {inferDirectTransactionAction} from '../src/aiIntent.js';
for(const language of ['id','en']){
  const welcome=aiWelcome(language),prompts=aiQuickPrompts(language);
  assert.ok(welcome.length<350,'Welcome must be concise');
  assert.match(welcome,/Dokter Keuangan AI/);
  assert.equal(prompts.length,4);
  assert.equal(new Set(prompts.map(item=>item.id)).size,4);
  for(const item of prompts){
    assert.ok(item.label.length<=22);
    assert.equal(inferDirectTransactionAction(item.prompt,'IDR'),null,'Review prompts must never become direct financial mutations');
  }
}
assert.equal(aiWelcome('unknown'),aiWelcome('id'));
assert.match(aiWelcome('en'),/limited to the data available/);
assert.match(aiWelcome('id'),/terbatas pada data/);
assert.deepEqual(aiQuickPrompts('en').map(item=>item.id),aiQuickPrompts('id').map(item=>item.id));
assert.match(aiResponseInstruction('en'),/Reply.*English/);
assert.match(aiResponseInstruction('id'),/Jawab.*Indonesia/);
assert.equal(aiResponseInstruction('unknown'),aiResponseInstruction('id'));
console.log('AI presentation passed: concise bilingual welcome, bounded labels, safe review-only prompts, language fallback');
