const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const context = vm.createContext({});
for (const name of ['normalizeAnswer', 'matchesTypedAnswer', 'activeItems']) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}
for (const [given, expected] of [['napleon','Napoleon'], ['Napoelon','Napoleon'], ['Napoleonn','Napoleon'], ['Napoleom','Napoleon'], ['Španija','spanija'], ['Sveta Jelena','sveta jelena']]) {
  assert.equal(context.matchesTypedAnswer(given, expected), true, `${given} should match ${expected}`);
}
for (const [given, expected] of [['1805','1804'], ['Sb','Sn'], ['Rim','Rom'], ['Napolxxn','Napoleon'], ['','Napoleon'], ['195','194']]) {
  assert.equal(context.matchesTypedAnswer(given, expected), false, `${given} should not match ${expected}`);
}
const chapter = {items: [{id:'a'}, {id:'b'}, {id:'c', enabled:false}]};
assert.deepEqual(Array.from(context.activeItems(chapter, {itemSet:'items',itemIds:['b','c']}), x=>x.id), ['b']);
assert.deepEqual(Array.from(context.activeItems(chapter, {itemSet:'items'}), x=>x.id), ['a','b']);
console.log('Typed answer and thematic activity checks passed.');
