const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const admin = fs.readFileSync(path.join(__dirname, '../admin/admin.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(admin.slice(admin.indexOf('function poolNames('), admin.indexOf('function appendProposal('))
  + app.slice(app.indexOf('function chapterCardCount('), app.indexOf('function breadcrumb(')), ctx);
const geography = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/subjects/geografija.json'), 'utf8'));
const greece = geography.chapters.at(-1);
assert.equal(ctx.chapterCardCount(greece), 15);
assert.equal(ctx.questionTotal(greece), 12);
assert.equal(ctx.visiblePools(greece).length, 2);
for (const pool of ctx.visiblePools(greece)) assert.ok(!ctx.poolLabel(greece, pool).includes('aiPool_'));
const challenge = {items:[],questions:[],aiPool_test:[{kind:'matching',prompt:'P?',choices:['A','B','C']}],
  activities:[{type:'choice-quiz',itemSet:'aiPool_test'}]};
assert.equal(ctx.poolLabel(challenge, 'aiPool_test'), 'Povezivanje pojmova');
assert.equal(ctx.questionTotal(challenge), 1);
assert.equal(ctx.chapterCardCount(challenge), 0);
const cards = {items:[{question:'A',enabled:false}],bank:[{question:'B'},{question:'C'}],
  activities:[{type:'flashcards',itemSet:'bank'},{type:'text-quiz',itemSet:'bank'}]};
assert.equal(ctx.chapterCardCount(cards), 2, 'Shared card banks must be counted once and disabled cards excluded');
console.log('PASS: existing AI content, friendly bank names, challenge totals and card counts.');
