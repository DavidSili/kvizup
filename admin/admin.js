'use strict';
const root = document.querySelector('#admin-app');
const notice = document.querySelector('#notice');
const dialog = document.querySelector('#ai-dialog');
let session = {}, subjects = [], selected = null, chapterIndex = -1, dirty = false, proposal = null, generating = false;
const clone = value => JSON.parse(JSON.stringify(value));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text, error = false) { notice.textContent = text; notice.classList.toggle('error', error); }
async function api(action, body) {
  const options = {headers: {}, credentials: 'same-origin'};
  if (body !== undefined) {
    options.method = 'POST'; options.headers['X-CSRF-Token'] = session.csrf;
    if (body instanceof FormData) options.body = body;
    else { options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
  }
  const response = await fetch(`api.php?action=${action}`, options);
  const data = await response.json().catch(() => ({error:'Server nije vratio očekivan odgovor. Proveri veličinu slika i PHP podešavanja.'}));
  if (!response.ok) throw new Error(data.error || 'Operacija nije uspela.');
  return data;
}
function markDirty() { dirty = true; document.querySelector('#save-state')?.replaceChildren('Nesačuvane izmene'); }
function canLeave() { return !dirty || confirm('Imaš nesačuvane izmene. Odbaci ih?'); }
function chapter() { return selected?.subject.chapters[chapterIndex]; }
function textField(label, value, target, field, multiline = false, disabled = false) {
  const attrs = `data-target="${target}" data-field="${field}" ${disabled ? 'disabled' : ''}`;
  return `<label>${esc(label)}${multiline ? `<textarea ${attrs} rows="3">${esc(value)}</textarea>` : `<input ${attrs} value="${esc(value)}">`}</label>`;
}
function poolNames(c) { return Object.keys(c).filter(key => Array.isArray(c[key]) && key !== 'activities'); }
function correctionMarkup(corrections) {
  return corrections.length ? `<div class="admin-warning"><strong>AI je ispravio ${corrections.length} činjeničnih navoda — pregledaj ispravke</strong><ul>${corrections.map(c=>`<li><strong>${esc(c.original)} → ${esc(c.corrected)}</strong><br>${esc(c.reason)}</li>`).join('')}</ul></div>` : '<p>AI nije prijavio činjenične ispravke.</p>';
}
function importMarkup() {
  return (selected.importReports || []).map(report=>`<section class="admin-panel"><h3>Rezultat AI unosa</h3><p>Dodato u ${esc(report.title)}: ${report.cards} kartica, ${report.questions} pitanja sa izborom i ${report.activities} aktivnosti.</p>${correctionMarkup(report.corrections)}</section>`).join('');
}
function recordsMarkup(c, scope = 'chapter') {
  return poolNames(c).map(set => `<section class="admin-panel"><div class="admin-actions"><h3>${esc(set === 'items' ? 'Kartice / pojmovi' : set === 'questions' ? 'Pitanja sa izborom' : set)} (${c[set].length})</h3><button data-add-record="${esc(set)}" data-scope="${scope}">Dodaj zadatak</button></div>${c[set].map((record, index) => {
    const fields = Object.keys(record).filter(key => typeof record[key] === 'string');
    return `<details class="record"><summary>${index + 1}. ${esc(record.question || record.prompt || record.name || record.title || record.id)}</summary><div class="record-fields">${fields.map(key => textField(({question:'Pitanje',prompt:'Pitanje',answer:'Tačan odgovor',description:'Objašnjenje',name:'Naziv',symbol:'Simbol',id:'ID',image:'Slika'})[key] || key, record[key], `${scope}/${set}/${index}`, key, key !== 'id' && key !== 'image')).join('')}${Array.isArray(record.choices) ? textField('Ponuđeni odgovori (jedan po redu)',record.choices.join('\n'),`${scope}/${set}/${index}`,'choices',true) : ''}<label class="inline"><input type="checkbox" data-target="${scope}/${set}/${index}" data-field="enabled" ${record.enabled !== false ? 'checked' : ''}> Uključeno</label><button class="danger" data-delete-record="${esc(set)}/${index}" data-scope="${scope}">Obriši zadatak</button></div></details>`;
  }).join('')}</section>`).join('');
}
function activityMarkup(c) {
  return `<section class="admin-panel"><div class="admin-actions"><h3>Aktivnosti / igre</h3><button data-action="add-activity">Dodaj aktivnost</button></div>${c.activities.map((a,index) => `<details class="record"><summary>${esc(a.title)} · ${esc(a.type)}</summary><div class="record-fields">${Object.keys(a).filter(key => typeof a[key] === 'string' && key !== 'type').map(key => textField(({id:'ID',title:'Naziv',description:'Opis',itemSet:'Skup zadataka',frontField:'Polje na prednjoj strani',backField:'Polje na poleđini',promptField:'Polje pitanja',answerField:'Polje odgovora'})[key] || key,a[key],`activity/${index}`,key,key==='description')).join('')}<label>Tip<select data-target="activity/${index}" data-field="type">${['flashcards','choice-quiz','text-quiz'].map(type=>`<option ${type===a.type?'selected':''}>${type}</option>`).join('')}</select></label><label>Broj pitanja (prazno = iz podešavanja)<input type="number" min="1" max="50" data-target="activity/${index}" data-field="questionCount" value="${a.questionCount || ''}"></label><button class="danger" data-delete-activity="${index}">Obriši aktivnost</button></div></details>`).join('')}</section>`;
}
function render() {
  document.querySelector('#account').textContent = session.user || '';
  document.querySelector('#logout').hidden = !session.user;
  if (!session.user) {
    root.innerHTML = `<form id="login" class="admin-panel login-panel"><h1>Uređivanje lekcija</h1><label>Korisničko ime<input name="username" autocomplete="username" required></label><label>Lozinka<input name="password" type="password" autocomplete="current-password" required></label><button>Prijavi se</button></form>`;
    return;
  }
  root.innerHTML = `<div class="admin-layout"><aside class="admin-panel"><h2>Predmeti</h2>${subjects.map((entry,index)=>`<button class="subject-button" data-subject="${index}">${esc(entry.subject.icon)} ${esc(entry.subject.title)}</button>`).join('')}<button data-action="new-subject">+ Novi predmet</button></aside><div id="editor">${selected ? importMarkup()+editorMarkup() : '<section class="admin-panel"><h1>Tvoje lekcije</h1><p>Izaberi predmet ili dodaj novi.</p></section>'}</div></div>`;
}
function editorMarkup() {
  const s=selected.subject, c=chapter();
  return `<section class="admin-panel"><div class="admin-actions"><h1>${esc(s.title)}</h1><button data-action="save">Sačuvaj predmet</button><span id="save-state">${dirty?'Nesačuvane izmene':'Sačuvano'}</span></div><div class="admin-grid">${textField('ID predmeta',s.id,'subject','id',false,selected.revision!==null)}${textField('Naziv',s.title,'subject','title')}${textField('Ikonica',s.icon,'subject','icon')}${textField('Opis',s.description,'subject','description',true)}</div><div class="admin-actions"><button data-action="export">Preuzmi JSON nacrt</button><button class="danger" data-action="delete-subject">Obriši predmet</button></div></section><section class="admin-panel"><div class="admin-actions"><h2>Poglavlja</h2><button data-action="new-chapter">+ Novo poglavlje</button></div><div class="chapter-tabs">${s.chapters.map((ch,index)=>`<button data-chapter="${index}" ${index===chapterIndex?'class="selected"':''}>${esc(ch.title)}</button>`).join('')}</div></section>${c?`<section class="admin-panel"><div class="admin-actions"><h2>${esc(c.title)}</h2><button data-action="ai" ${session.aiReady?'':'disabled'}>Dodaj gradivo uz AI</button><button class="danger" data-action="delete-chapter">Obriši poglavlje</button></div>${!session.aiReady?'<p>AI unos će biti dostupan kada se podesi OpenAI API ključ.</p>':''}<div class="admin-grid">${textField('ID poglavlja',c.id,'chapter','id')}${textField('Naziv',c.title,'chapter','title')}${textField('Opis',c.description,'chapter','description',true)}</div></section>${recordsMarkup(c)}${activityMarkup(c)}<details class="admin-panel"><summary>Napredno: celo poglavlje kao JSON</summary><p>Za posebna polja i nove skupove zadataka. Proveri JSON pre primene.</p><textarea id="chapter-json" rows="14">${esc(JSON.stringify(c,null,2))}</textarea><button data-action="apply-json">Primeni JSON u nacrt</button></details>`:''}`;
}
async function loadSubjects() { subjects=(await api('subjects')).subjects; }
function id(prefix) { return `${prefix}-${crypto.randomUUID().slice(0,8)}`; }
function emptyChapter() { return {id:id('poglavlje'),title:'Novo poglavlje',description:'',icon:'📘',items:[],questions:[],activities:[{id:'kartice',type:'flashcards',title:'Kartice',description:'',itemSet:'items',frontField:'question',backField:'answer'},{id:'test',type:'choice-quiz',title:'Test sa izborom',description:'',itemSet:'questions'}]}; }
document.addEventListener('input',event=>{
  const el=event.target, target=el.dataset.target, field=el.dataset.field;
  if(!target) return;
  const parts=target.split('/');
  let object=parts[0]==='subject'?selected.subject:parts[0]==='activity'?chapter().activities[Number(parts[1])]:parts.length===1?chapter():(parts[0]==='proposal'?proposal.chapter:chapter())[parts[1]][Number(parts[2])];
  if(field==='questionCount' && el.value==='') delete object[field];
  else object[field]=field==='choices'?el.value.split('\n'):field==='enabled'?el.checked:field==='questionCount'?Number(el.value):el.value;
  if(parts[0]!=='proposal') markDirty();
});
document.addEventListener('submit',async event=>{
  // A form control named "id" shadows the form.id DOM property.
  const formId=event.target.getAttribute('id');
  if(formId==='login') {
    event.preventDefault(); const form=event.target; const button=form.querySelector('button'); button.disabled=true;
    try { session=await api('login',Object.fromEntries(new FormData(form))); await loadSubjects(); render(); message('Dobro došla / dobro došao!'); }
    catch(error){message(error.message,true);} finally {button.disabled=false;}
  }
  if(formId==='ai-form') {
    event.preventDefault(); const form=event.target; const data=new FormData(form); const types=data.getAll('type');
    if(!types.length){document.querySelector('#ai-error').textContent='Izaberi bar jednu aktivnost.';return;}
    const files=[...form.querySelector('input[type=file]').files];
    if(files.length>8 || files.some(file=>file.size>5*1024*1024) || files.reduce((sum,file)=>sum+file.size,0)>20*1024*1024){document.querySelector('#ai-error').textContent='Najviše 8 slika, do 5 MB po slici i 20 MB ukupno.';return;}
    data.set('types',JSON.stringify(types)); generating=true; document.querySelector('#generate').disabled=true; document.querySelector('#close-ai').disabled=true;
    document.querySelector('#ai-error').textContent='AI priprema predlog. Ovo može potrajati do nekoliko minuta…';
    try { proposal=await api('generate',data); document.querySelector('#ai-error').textContent=''; form.hidden=true; renderProposal(); }
    catch(error){document.querySelector('#ai-error').textContent=error.message;}
    finally{generating=false;document.querySelector('#generate').disabled=false;document.querySelector('#close-ai').disabled=false;}
  }
});
function renderProposal() {
  const section=document.querySelector('#proposal');section.hidden=false;
  section.innerHTML=`<h2>Pregledaj AI predlog</h2><p>Pripremljeno: ${proposal.chapter.items.length} kartica, ${proposal.chapter.questions.length} pitanja sa izborom i ${proposal.chapter.activities.length} aktivnosti. Izmeni pitanja i odgovore. Ništa još nije sačuvano.</p>${correctionMarkup(proposal.corrections || [])}${proposal.warnings.length?`<div class="admin-warning"><strong>Proveri pre čuvanja</strong><ul>${proposal.warnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<ul>${proposal.chapter.activities.map(a=>`<li>${esc(a.title)} (${a.itemIds?.length || 0} zadataka)</li>`).join('')}</ul>${recordsMarkup(proposal.chapter,'proposal')}<div class="admin-actions"><button data-action="accept-ai">Dodaj u poglavlje</button><button data-action="discard-ai">Odbaci predlog</button></div>`;
}
document.addEventListener('click',async event=>{
  const button=event.target.closest('button'); if(!button || button.disabled) return;
  try {
    if(button.id==='logout'){if(!canLeave())return;await api('logout',{});selected=null;dirty=false;session=await api('session');render();return;}
    if(button.id==='close-ai'){dialog.close();return;}
    if(button.dataset.subject!==undefined){if(!canLeave())return;selected=clone(subjects[Number(button.dataset.subject)]);chapterIndex=selected.subject.chapters.length?0:-1;dirty=false;render();return;}
    if(button.dataset.chapter!==undefined){chapterIndex=Number(button.dataset.chapter);render();return;}
    if(button.dataset.addRecord){const c=button.dataset.scope==='proposal'?proposal.chapter:chapter(),set=button.dataset.addRecord;c[set].push(set==='items'?{id:id('card'),question:'Novo pitanje',answer:'Odgovor',description:''}:{id:id('question'),prompt:'Novo pitanje',answer:'Tačan odgovor',choices:['Tačan odgovor','Drugi odgovor','Treći odgovor']});if(button.dataset.scope==='proposal')renderProposal();else{markDirty();render();}return;}
    if(button.dataset.deleteRecord){if(!confirm('Obriši ovaj zadatak iz nacrta?'))return;const [set,index]=button.dataset.deleteRecord.split('/');const c=button.dataset.scope==='proposal'?proposal.chapter:chapter();const removed=c[set].splice(Number(index),1)[0];c.activities=c.activities.filter(a=>{if(a.itemSet===set && a.itemIds){a.itemIds=a.itemIds.filter(id=>id!==removed.id);return a.itemIds.length>0;}return true;});if(button.dataset.scope==='proposal')renderProposal();else{markDirty();render();}return;}
    if(button.dataset.deleteActivity!==undefined){if(!confirm('Obriši ovu aktivnost iz nacrta?'))return;chapter().activities.splice(Number(button.dataset.deleteActivity),1);markDirty();render();return;}
    const action=button.dataset.action;
    if(action==='new-subject'){if(!canLeave())return;selected={revision:null,subject:{id:id('predmet'),title:'Novi predmet',description:'',icon:'📘',chapters:[]}};chapterIndex=-1;dirty=true;render();}
    if(action==='new-chapter'){selected.subject.chapters.push(emptyChapter());chapterIndex=selected.subject.chapters.length-1;dirty=true;render();}
    if(action==='save'){
      button.disabled=true;
      const snapshot=JSON.stringify(selected.subject);
      try{const result=await api('save',{id:selected.subject.id,revision:selected.revision,subject:JSON.parse(snapshot)});selected.revision=result.revision;dirty=JSON.stringify(selected.subject)!==snapshot;await loadSubjects();render();message(dirty?'Sačuvana je poslata verzija. Novije izmene još nisu sačuvane.':'Predmet je sačuvan. Dostupan je u aplikaciji.');}
      finally{button.disabled=false;}
    }
    if(action==='delete-subject'){
      if(!confirm(`Obriši ceo predmet „${selected.subject.title}“ i sva poglavlja?`))return;
      if(selected.revision!==null)await api('delete',{id:selected.subject.id,revision:selected.revision});
      selected=null;dirty=false;await loadSubjects();render();message('Predmet je obrisan.');
    }
    if(action==='delete-chapter'){if(!confirm('Obriši poglavlje i sve njegove zadatke iz nacrta?'))return;selected.subject.chapters.splice(chapterIndex,1);chapterIndex=selected.subject.chapters.length?0:-1;dirty=true;render();}
    if(action==='add-activity'){chapter().activities.push({id:id('aktivnost'),type:'choice-quiz',title:'Nova aktivnost',description:'',itemSet:'questions',promptField:'prompt',answerField:'answer'});dirty=true;render();}
    if(action==='apply-json'){const value=JSON.parse(document.querySelector('#chapter-json').value);if(!value || typeof value!=='object' || !Array.isArray(value.activities))throw new Error('Poglavlje mora biti objekat sa aktivnostima.');selected.subject.chapters[chapterIndex]=value;dirty=true;render();}
    if(action==='export'){const blob=new Blob([JSON.stringify(selected.subject,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='kvizup-nacrt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(action==='ai'){const form=document.querySelector('#ai-form');form.hidden=false;document.querySelector('#proposal').hidden=true;document.querySelector('#ai-error').textContent='';form.elements.title.value=chapter().title;form.elements.id.value=chapter().id;form.elements.id.readOnly=true;dialog.showModal();}
    if(action==='discard-ai'){proposal=null;dialog.close();}
    if(action==='accept-ai'){
      const c=chapter(), incoming=proposal.chapter;
      if(!incoming.items.length && !incoming.questions.length)throw new Error('Predlog nema zadataka. Dopuni materijal i pokušaj ponovo.');
      // Separate AI pools preserve existing field mappings (e.g. chemistry symbols).
      const suffix=crypto.randomUUID().slice(0,8),cardSet='aiCards_'+suffix,questionSet='aiQuestions_'+suffix;
      c.activities=c.activities.filter(a=>!(['kartice','test'].includes(a.id) && (c[a.itemSet || 'items'] || []).length===0));
      c[cardSet]=clone(incoming.items);c[questionSet]=clone(incoming.questions);
      c.activities.push(...incoming.activities.map(a=>({...a,itemSet:a.itemSet==='items'?cardSet:questionSet})));
      if(!c.description)c.description=incoming.description;
      const report={title:c.title,cards:incoming.items.length,questions:incoming.questions.length,activities:incoming.activities.length,corrections:clone(proposal.corrections || [])};
      (selected.importReports ||= []).push(report);
      dirty=true;proposal=null;dialog.close();render();message(`Dodato u nacrt: ${report.cards} kartica, ${report.questions} pitanja i ${report.activities} aktivnosti. AI je prijavio ${report.corrections.length} ispravki; detalji su ispod. Klikni „Sačuvaj predmet“ za objavljivanje.`);
    }
  }catch(error){if(dialog.open)document.querySelector('#ai-error').textContent=error.message;else message(error.message,true);}
});
document.querySelector('#ai-form input[type=file]').addEventListener('change',event=>{
  const previews=document.querySelector('#image-previews');previews.replaceChildren();
  [...event.target.files].slice(0,8).forEach(file=>{const img=document.createElement('img');const url=URL.createObjectURL(file);img.src=url;img.alt=file.name;img.onload=()=>URL.revokeObjectURL(url);previews.append(img);});
});
dialog.addEventListener('cancel',event=>{if(generating)event.preventDefault();});
window.addEventListener('beforeunload',event=>{if(dirty || generating){event.preventDefault();event.returnValue='';}});
(async()=>{try{session=await api('session');if(session.user)await loadSubjects();render();}catch(error){message(error.message,true);}})();
