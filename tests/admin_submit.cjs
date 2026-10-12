// Regression check for form controls shadowing native form properties.
// Run: node tests/admin_submit.cjs (no dependencies or real AI requests).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function check({types, failure}) {
  const listeners = {};
  const nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      addEventListener() {}, classList: {toggle() {}}, textContent: '', disabled: false,
    });
    return nodes.get(selector);
  };
  let request;
  class FormData {
    constructor(form) { this.form = form; this.values = {}; }
    getAll() { return types; }
    set(key, value) { this.values[key] = value; }
  }
  const context = vm.createContext({
    document: {querySelector: node, addEventListener(name, handler) { listeners[name] = handler; }},
    window: {addEventListener() {}}, FormData,
    fetch(url, options) {
      // Keep startup pending; the submit handler itself is exercised below.
      if (url.endsWith('action=session')) return new Promise(() => {});
      request = {url, options};
      return Promise.resolve({ok: !failure, json: async () => failure
        ? {error: 'Test API error'}
        : {chapter: {items: [], questions: [], activities: []}, warnings: [], corrections: []}});
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/admin.js'), 'utf8'), context);
  const form = {
    // HTMLFormElement.id becomes the named input, rather than "ai-form".
    id: {name: 'id', value: 'poglavlje-test'},
    getAttribute(name) { return name === 'id' ? 'ai-form' : null; },
    querySelector() { return {files: [{size: 1234}]}; },
    hidden: false,
  };
  let prevented = false;
  const pending = listeners.submit({target: form, preventDefault() { prevented = true; }});
  assert.equal(prevented, true, 'Submit must prevent navigation synchronously');
  await pending;
  if (!types.length) {
    assert.equal(request, undefined, 'Invalid form must not call AI');
    assert.ok(node('#ai-error').textContent);
  } else {
    assert.equal(request.url, 'api.php?action=generate');
    assert.equal(request.options.method, 'POST');
    assert.equal(request.options.body.values.types, JSON.stringify(types));
    assert.equal(node('#generate').disabled, false);
    assert.equal(node('#close-ai').disabled, false);
    if (failure) {
      assert.equal(form.hidden, false, 'API failure must preserve the form');
      assert.equal(node('#ai-error').textContent, 'Test API error');
    } else {
      assert.equal(form.hidden, true);
      assert.equal(node('#proposal').hidden, false);
      assert.match(node('#proposal').innerHTML, /Pregledaj AI predlog/);
    }
  }
}

(async () => {
  await check({types: ['flashcards', 'choice-quiz']});
  await check({types: ['flashcards'], failure: true});
  await check({types: []});
  console.log('Admin submit checks passed (proposal, API error, validation).');
})().catch(error => { console.error(error); process.exitCode = 1; });
