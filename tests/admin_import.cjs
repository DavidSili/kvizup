const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../admin/admin.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext('const clone = value => JSON.parse(JSON.stringify(value));' + source.slice(source.indexOf('function poolNames('), source.indexOf('function correctionMarkup(')), context);
const chapter = {items: [{id:'old'}], activities: [{id:'existing',itemSet:'items'}]};
const incoming = {items:[{id:'card'}],questions:[{id:'question'}],shortAnswers:[{id:'short'}],activities:[
  {id:'cards',title:'Cards',itemSet:'items',itemIds:['card']},
  {id:'quiz',title:'Quiz',itemSet:'questions',itemIds:['question']},
  {id:'typed',title:'Typed',itemSet:'shortAnswers',itemIds:['short']},
]};
context.appendProposal(chapter,incoming,'test');
for (const activity of chapter.activities) {
  assert.ok(Array.isArray(chapter[activity.itemSet]));
  for (const id of activity.itemIds || []) assert.ok(chapter[activity.itemSet].some(record=>record.id===id));
}
assert.equal(chapter.items[0].id,'old');
const snapshot=JSON.stringify(chapter);
assert.throws(()=>context.appendProposal(chapter,{items:[],activities:[{title:'Broken',itemSet:'missing'}]},'broken'));
assert.equal(JSON.stringify(chapter),snapshot,'Invalid proposals must not partially modify a chapter');
console.log('AI import checks passed: all banks, thematic IDs, existing content and invalid references.');
