const STORAGE = {
  preferences: 'kvizupPreferences',
  report: 'kvizupDailyReport',
  statsPrefix: 'kvizupStats:'
};

const defaults = { questionCount: 20, favorWeak: true };
let preferences = { ...defaults };
let subjects = [];
let subjectCache = new Map();
let currentSubject = null;
let currentChapter = null;
let currentActivity = null;
let practice = null;
let renderVersion = 0;
const app = document.querySelector('#app');

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
function saveStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dailyReport() {
  const saved = readStorage(STORAGE.report, { date: today(), tests: [] });
  return saved.date === today() ? saved : { date: today(), tests: [] };
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}
function normalizeAnswer(value) {
  return String(value ?? '').trim().toLocaleUpperCase('sr-Latn-RS')
    .replace(/Đ/g, 'DJ').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/Ć|Č/g, 'C').replace(/Š/g, 'S').replace(/Ž/g, 'Z').replace(/\s+/g, '');
}
function field(item, key) { return item?.[key] == null ? '' : String(item[key]); }
function storageStatsKey() { return `${STORAGE.statsPrefix}${currentSubject.id}:${currentChapter.id}`; }
function itemKey(item) { return item.id || item.symbol || item.name || item.title || item.question; }
function getStats() { return readStorage(storageStatsKey(), {}); }
function activeItems(chapter = currentChapter, activity = currentActivity) {
  const collection = activity?.itemSet ? chapter[activity.itemSet] : chapter.items;
  return (collection || []).filter(item => item.enabled !== false);
}
function pickItem(pool = activeItems()) {
  if (!pool.length) return null;
  const stats = getStats();
  const weighted = pool.flatMap(item => {
    const stat = stats[itemKey(item)] || { seen: 0, correct: 0 };
    const accuracy = stat.seen ? stat.correct / stat.seen : 0;
    const weight = preferences.favorWeak ? Math.max(1, Math.round((1.2 - accuracy) * 4)) : 1;
    return Array.from({ length: weight }, () => item);
  });
  return weighted[Math.floor(Math.random() * weighted.length)] || pool[0];
}
function updateStats(item, correct) {
  const stats = getStats();
  const key = itemKey(item);
  const stat = stats[key] || { seen: 0, correct: 0 };
  stat.seen += 1;
  if (correct) stat.correct += 1;
  stats[key] = stat;
  saveStorage(storageStatsKey(), stats);
}
function imageMarkup(item, includeDescription = false) {
  const imageName = field(item, currentChapter.imageField || 'image');
  if (!imageName) return '';
  const directory = currentChapter.imageDirectory || 'images';
  const label = field(item, 'name') || field(item, 'title') || field(item, 'question');
  const description = includeDescription && field(item, 'description')
    ? `<p class="element-description">${escapeHtml(field(item, 'description'))}</p>`
    : '';
  return `<img class="card-image" src="${escapeHtml(directory)}/${encodeURIComponent(imageName)}" alt="${escapeHtml(label)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="image-placeholder" hidden>${escapeHtml(field(item, 'symbol') || label.slice(0, 1))}</span>${description}`;
}
function referenceMarkup(item) {
  if (!item.referenceImage) return '';
  return `<a class="reference-link" href="${escapeHtml(currentChapter.imageDirectory || 'images')}/${encodeURIComponent(item.referenceImage)}" target="_blank" rel="noopener">Pogledaj sliku iz lekcije</a>`;
}
function itemCount(subject) { return (subject.chapters || []).reduce((count, chapter) => count + (chapter.items || []).length, 0); }
function breadcrumb(parts) { return `<div class="breadcrumb">${parts.map((part, index) => `${index ? '<span>›</span>' : ''}${part.href ? `<a href="${part.href}">${escapeHtml(part.label)}</a>` : `<span>${escapeHtml(part.label)}</span>`}`).join('')}</div>`; }
function tile(href, icon, title, description, meta = '') {
  return `<a class="tile" href="${href}"><span class="tile-icon">${escapeHtml(icon || '✦')}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description || '')}</p>${meta ? `<p class="tile-meta">${escapeHtml(meta)}</p>` : ''}</a>`;
}
function homeView() {
  const cards = subjects.map(subject => tile(`#subject/${encodeURIComponent(subject.id)}`, subject.icon, subject.title, subject.description, `${subject.chapterCount} ${subject.chapterCount === 1 ? 'poglavlje' : 'poglavlja'}`)).join('');
  return `<section class="hero"><span class="eyebrow">Tvoj prostor za učenje</span><span class="hero-rule"></span><h1>Šta danas učiš?</h1><p class="lead">Izaberi predmet, pronađi poglavlje i vežbaj na način koji ti najviše odgovara.</p></section><div class="section-heading"><h2>Predmeti</h2><p>${subjects.length} dostupno</p></div><section class="tile-grid">${cards || '<div class="empty">Još nema dodatih predmeta.</div>'}</section><section class="stat-row"><div class="stat"><strong>${dailyReport().tests.length}</strong><span>testova danas</span></div><div class="stat"><strong>${itemCountForAll()}</strong><span>pojmova u biblioteci</span></div><div class="stat"><strong>3</strong><span>načina vežbanja</span></div></section>`;
}
function itemCountForAll() { return subjects.reduce((total, subject) => total + (subject.itemCount || 0), 0); }
function subjectView(subject) {
  const cards = (subject.chapters || []).map(chapter => tile(`#chapter/${encodeURIComponent(subject.id)}/${encodeURIComponent(chapter.id)}`, chapter.icon || subject.icon, chapter.title, chapter.description, `${(chapter.items || []).filter(item => item.enabled !== false).length} pojmova · ${(chapter.activities || []).length} aktivnosti`)).join('');
  return `${breadcrumb([{ label: 'Predmeti', href: '#home' }, { label: subject.title }])}<section class="hero"><span class="eyebrow">Predmet</span><h1>${escapeHtml(subject.title)}</h1><p class="lead">${escapeHtml(subject.description || '')}</p></section><div class="section-heading"><h2>Poglavlja</h2><p>${subject.chapterCount || subject.chapters.length} ukupno</p></div><section class="tile-grid">${cards || '<div class="empty">Još nema poglavlja u ovom predmetu.</div>'}</section>`;
}
function chapterView(subject, chapter) {
  const cards = (chapter.activities || []).map(activity => tile(`#activity/${encodeURIComponent(subject.id)}/${encodeURIComponent(chapter.id)}/${encodeURIComponent(activity.id)}`, activity.icon || '✦', activity.title, activity.description, activity.type === 'flashcards' ? 'Kartice' : activity.kindLabel || 'Vežba')).join('');
  return `${breadcrumb([{ label: 'Predmeti', href: '#home' }, { label: subject.title, href: `#subject/${encodeURIComponent(subject.id)}` }, { label: chapter.title }])}<section class="hero"><span class="eyebrow">Poglavlje</span><h1>${escapeHtml(chapter.title)}</h1><p class="lead">${escapeHtml(chapter.description || '')}</p></section><div class="section-heading"><h2>Izaberi vežbu</h2><p>${(chapter.items || []).filter(item => item.enabled !== false).length} pojmova</p></div><section class="tile-grid">${cards || '<div class="empty">Nema aktivnosti u ovom poglavlju.</div>'}</section>`;
}
function flashcardsView(activity) {
  if (!practice || practice.activityId !== activity.id) practice = { activityId: activity.id, item: pickItem(), index: 0, flipped: false };
  if (!practice.item) return '<div class="empty">Nema aktivnih kartica u ovom poglavlju.</div>';
  const frontKey = activity.frontField || 'question';
  const backKey = activity.backField || 'answer';
  const display = (key, side) => {
    const value = field(practice.item, key);
    const image = activity.imageOn === side ? imageMarkup(practice.item) : '';
    const description = field(practice.item, activity.descriptionField || 'description');
    const showDescription = activity.imageOn ? activity.imageOn === side : side === 'back';
    const className = key === 'symbol' ? 'card-value card-value--symbol' : 'card-value';
    return `${image}<span class="${className}">${escapeHtml(value)}</span>${description && showDescription ? `<p class="element-description">${escapeHtml(description)}</p>` : ''}${side === 'front' ? referenceMarkup(practice.item) : ''}`;
  };
  const imageName = field(practice.item, activity.imageField || currentChapter.imageField || 'image');
  const imageClass = imageName ? 'has-card-image' : '';
  return `${breadcrumb([{ label: 'Predmeti', href: '#home' }, { label: currentSubject.title, href: `#subject/${encodeURIComponent(currentSubject.id)}` }, { label: currentChapter.title, href: `#chapter/${encodeURIComponent(currentSubject.id)}/${encodeURIComponent(currentChapter.id)}` }])}<div class="practice-head"><span class="eyebrow">Kartice · ${escapeHtml(activity.title)}</span><span class="progress">Kartica ${practice.index + 1}</span></div><div class="flashcard-wrap"><section class="quiz-panel flashcard ${imageClass} ${practice.flipped ? 'card-back is-flipped' : 'card-front'}" data-flip role="button" tabindex="0" aria-label="Okreni karticu"><div class="card-face card-front">${display(frontKey, 'front')}<span class="card-hint">Dodirni da okreneš</span></div><div class="card-face card-back">${display(backKey, 'back')}<span class="card-hint">Dodirni za sledeću</span></div></section></div><div class="actions"><button class="button primary" data-next-card>Sledeća kartica</button><a class="button secondary" href="#chapter/${encodeURIComponent(currentSubject.id)}/${encodeURIComponent(currentChapter.id)}">Završi vežbu</a></div>`;
}
function textQuizView(activity) {
  const count = Math.max(1, Number(activity.questionCount || preferences.questionCount));
  if (!practice || practice.activityId !== activity.id) practice = { activityId: activity.id, questions: [], index: 0, answered: false, correct: 0, answerValue: '' };
  if (!practice.questions.length) practice.questions = Array.from({ length: count }, () => pickItem(activeItems(currentChapter, activity)));
  const item = practice.questions[practice.index];
  if (!item) return '<div class="empty">Nema aktivnih pitanja u ovom poglavlju.</div>';
  const expected = field(item, activity.answerField || 'answer');
  const showImage = activity.imageField && (activity.imageTiming !== 'after-answer' || practice.answered);
  const result = practice.answered ? `<div class="result ${practice.lastCorrect ? 'correct' : 'wrong'}">${practice.lastCorrect ? 'Tačno!<small>Odličan odgovor.</small>' : `Nije tačno.<div class="answer-correction"><span>Tačan odgovor</span><strong>${escapeHtml(expected)}</strong></div>`}</div>` : '';
  const prompt = field(item, activity.promptField || 'question');
  return `${breadcrumb([{ label: 'Predmeti', href: '#home' }, { label: currentSubject.title, href: `#subject/${encodeURIComponent(currentSubject.id)}` }, { label: currentChapter.title, href: `#chapter/${encodeURIComponent(currentSubject.id)}/${encodeURIComponent(currentChapter.id)}` }])}<div class="practice-head"><span class="eyebrow">Test · ${escapeHtml(activity.title)}</span><span class="progress">Pitanje ${practice.index + 1} / ${count}</span></div><section class="quiz-panel"><div class="quiz-prompt ${prompt.length > 30 ? 'quiz-prompt--text' : ''}">${escapeHtml(prompt)}</div>${showImage ? imageMarkup(item, true) : ''}${practice.answered ? referenceMarkup(item) : ''}<input class="answer-input" data-answer autocomplete="off" autocapitalize="words" placeholder="Tvoj odgovor" aria-label="Upiši ${escapeHtml(activity.answerLabel || 'odgovor')}" value="${escapeHtml(practice.answerValue)}" ${practice.answered ? 'disabled' : ''}>${result}<button class="button primary" data-check-answer>${practice.answered ? (practice.index + 1 === count ? 'Završi test' : 'Sledeće pitanje') : 'Proveri odgovor'}</button></section>`;
}
function choiceQuizView(activity) {
  const count = Math.max(1, Number(activity.questionCount || preferences.questionCount));
  if (!practice || practice.activityId !== activity.id) practice = { activityId: activity.id, questions: [], index: 0, answered: false, correct: 0, answerValue: '' };
  if (!practice.questions.length) practice.questions = Array.from({ length: count }, () => pickItem(activeItems(currentChapter, activity)));
  const item = practice.questions[practice.index];
  if (!item) return '<div class="empty">Nema aktivnih pitanja u ovom poglavlju.</div>';
  const expected = field(item, activity.answerField || 'answer');
  const prompt = field(item, activity.promptField || 'prompt');
  const choices = (item.choices || []).map(option => `<button class="button secondary choice-option ${practice.answerValue === option ? 'is-selected' : ''}" data-choice="${escapeHtml(option)}" ${practice.answered ? 'disabled' : ''}>${escapeHtml(option)}</button>`).join('');
  const result = practice.answered ? `<div class="result ${practice.lastCorrect ? 'correct' : 'wrong'}">${practice.lastCorrect ? `Tačno!<small>Tačan odgovor: ${escapeHtml(expected)}</small>` : `Nije tačno.<div class="answer-correction"><span>Tačan odgovor</span><strong>${escapeHtml(expected)}</strong></div>`}</div>` : '';
  const buttonText = practice.answered ? (practice.index + 1 === count ? 'Završi test' : 'Sledeće pitanje') : 'Proveri odgovor';
  return `${breadcrumb([{ label: 'Predmeti', href: '#home' }, { label: currentSubject.title, href: `#subject/${encodeURIComponent(currentSubject.id)}` }, { label: currentChapter.title, href: `#chapter/${encodeURIComponent(currentSubject.id)}/${encodeURIComponent(currentChapter.id)}` }])}<div class="practice-head"><span class="eyebrow">${escapeHtml(activity.kindLabel || 'Igra znanja')}</span><span class="progress">Pitanje ${practice.index + 1} / ${count}</span></div><section class="quiz-panel"><div class="quiz-prompt quiz-prompt--text">${escapeHtml(prompt)}</div>${referenceMarkup(item)}<div class="choice-list">${choices}</div>${result}<button class="button primary" data-check-answer ${!practice.answered && !practice.answerValue ? 'disabled' : ''}>${buttonText}</button></section>`;
}
const activityRenderers = { flashcards: flashcardsView, 'text-quiz': textQuizView, 'choice-quiz': choiceQuizView };
function settingsView() {
  return `<section><span class="eyebrow">Podešavanja</span><h1>Prilagodi vežbanje.</h1><p class="lead">Opcije i napredak čuvaju se samo u ovom pregledaču.</p><section class="panel settings-panel"><div class="form-row"><label for="question-count">Broj pitanja<small>Podrazumevano pitanje po testu</small></label><input id="question-count" class="number-input" type="number" min="5" max="50" value="${preferences.questionCount}"></div><div class="form-row"><label for="favor-weak">Češće vežbaj teže pojmove<small>Prednost dobijaju slabije naučeni odgovori</small></label><label class="switch"><input id="favor-weak" type="checkbox" ${preferences.favorWeak ? 'checked' : ''}><span class="switch-track"></span></label></div><div class="form-row"><span><strong>Napredak i izveštaji</strong><small>Uklanjanje podataka sa ovog uređaja</small></span><button class="button secondary" data-reset>Obriši podatke</button></div></section><div class="actions"><a class="button secondary" href="#home">Nazad na predmete</a></div></section>`;
}
function reportView() {
  const report = dailyReport();
  const rows = [...report.tests].reverse().map(test => `<div class="report-row"><div><strong>${test.correct} / ${test.total}</strong><div class="muted">${escapeHtml(test.subjectTitle)} · ${escapeHtml(test.chapterTitle)} · ${escapeHtml(test.activityTitle)}</div></div><span class="muted">${escapeHtml(test.time)}</span></div>`).join('');
  const correct = report.tests.reduce((sum, test) => sum + test.correct, 0);
  const total = report.tests.reduce((sum, test) => sum + test.total, 0);
  return `<section><span class="eyebrow">Pregled napretka</span><h1>Izveštaj za danas.</h1><p class="lead">${report.tests.length ? 'Svi završeni testovi, iz svih predmeta.' : 'Kada završiš prvi test, rezultat će biti prikazan ovde.'}</p><div class="stat-row"><div class="stat"><strong>${report.tests.length}</strong><span>završenih testova</span></div><div class="stat"><strong>${total ? Math.round(correct / total * 100) : 0}%</strong><span>tačnih odgovora</span></div><div class="stat"><strong>${total}</strong><span>pitanja ukupno</span></div></div><div class="report-list">${rows || '<div class="empty">Još nema završenih testova.</div>'}</div></section>`;
}
async function loadSubject(subjectId) {
  if (subjectCache.has(subjectId)) return subjectCache.get(subjectId);
  const entry = subjects.find(subject => subject.id === subjectId);
  if (!entry) return null;
  const response = await fetch(entry.file);
  if (!response.ok) throw new Error(`Ne mogu da učitam predmet ${entry.title}.`);
  const subject = await response.json();
  subjectCache.set(subjectId, subject);
  return subject;
}
function routeParts() { return (location.hash.slice(1) || 'home').split('/').map(decodeURIComponent); }
async function render() {
  const version = ++renderVersion;
  const [route, subjectId, chapterId, activityId] = routeParts();
  app.dataset.mode = route === 'activity' ? activityId : route;
  try {
    if (route === 'home') {
      currentSubject = currentChapter = currentActivity = null;
      app.innerHTML = homeView();
    } else if (route === 'settings') {
      app.innerHTML = settingsView();
    } else if (route === 'report') {
      app.innerHTML = reportView();
    } else if (['subject', 'chapter', 'activity'].includes(route)) {
      const subject = await loadSubject(subjectId);
      if (version !== renderVersion) return;
      if (!subject) throw new Error('Predmet nije pronađen.');
      currentSubject = subject;
      if (route === 'subject') {
        currentChapter = currentActivity = null;
        app.innerHTML = subjectView(subject);
      } else {
        const chapter = (subject.chapters || []).find(item => item.id === chapterId);
        if (!chapter) throw new Error('Poglavlje nije pronađeno.');
        currentChapter = chapter;
        if (route === 'chapter') {
          currentActivity = null;
          app.innerHTML = chapterView(subject, chapter);
        } else {
          const activity = (chapter.activities || []).find(item => item.id === activityId);
          if (!activity) throw new Error('Aktivnost nije pronađena.');
          currentActivity = activity;
          const renderer = activityRenderers[activity.type];
          app.innerHTML = renderer ? renderer(activity) : `<div class="panel"><h2>Aktivnost nije podržana</h2><p class="lead">${escapeHtml(activity.title)}</p></div>`;
        }
      }
    } else {
      location.hash = '#home';
      return;
    }
  } catch (error) {
    if (version !== renderVersion) return;
    app.innerHTML = `<section class="panel"><h2>Ne mogu da otvorim sadržaj</h2><p class="lead">${escapeHtml(error.message)}</p><a class="button secondary" href="#home">Nazad na predmete</a></section>`;
  }
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('active', link.dataset.nav === route || (['subject', 'chapter', 'activity'].includes(route) && link.dataset.nav === 'home')));
}
function checkAnswer() {
  if (!currentActivity || !practice) return;
  const input = document.querySelector('[data-answer]');
  const answer = currentActivity.type === 'choice-quiz' ? practice.answerValue : input?.value;
  if (answer === undefined || answer === '') return;
  const item = practice.questions[practice.index];
  const expected = field(item, currentActivity.answerField || 'answer');
  const count = Math.max(1, Number(currentActivity.questionCount || preferences.questionCount));
  if (!practice.answered) {
    practice.answerValue = answer;
    practice.lastCorrect = normalizeAnswer(answer) === normalizeAnswer(expected);
    practice.answered = true;
    if (practice.lastCorrect) practice.correct += 1;
    updateStats(item, practice.lastCorrect);
    render();
    return;
  }
  if (practice.index + 1 === count) {
    const report = dailyReport();
    report.tests.push({ subjectTitle: currentSubject.title, chapterTitle: currentChapter.title, activityTitle: currentActivity.title, correct: practice.correct, total: count, time: new Date().toLocaleTimeString('sr-Latn-RS', { hour: '2-digit', minute: '2-digit' }) });
    saveStorage(STORAGE.report, report);
    practice = null;
    location.hash = '#report';
    return;
  }
  practice.index += 1;
  practice.answered = false;
  practice.answerValue = '';
  practice.lastCorrect = false;
  render();
}
app.addEventListener('click', event => {
  const target = event.target.closest('button, [data-flip]');
  if (!target) return;
  if (target.matches('[data-flip]')) {
    if (!practice.flipped) { practice.flipped = true; render(); }
    else { practice.item = pickItem(); practice.index += 1; practice.flipped = false; render(); }
  }
  if (target.matches('[data-next-card]')) { practice.item = pickItem(); practice.index += 1; practice.flipped = false; render(); }
  if (target.matches('[data-choice]') && !practice.answered) { practice.answerValue = target.dataset.choice; render(); }
  if (target.matches('[data-check-answer]')) checkAnswer();
  if (target.matches('[data-reset]')) {
    localStorage.removeItem(STORAGE.report);
    Object.keys(localStorage).filter(key => key.startsWith(STORAGE.statsPrefix)).forEach(key => localStorage.removeItem(key));
    render();
  }
  if (target.matches('[data-route]')) location.hash = `#${target.dataset.route}`;
});
app.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.matches('[data-answer]')) checkAnswer();
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-flip]')) { event.preventDefault(); event.target.click(); }
});
app.addEventListener('input', event => {
  if (event.target.matches('#question-count')) {
    preferences.questionCount = Math.max(5, Math.min(50, Number(event.target.value) || defaults.questionCount));
    saveStorage(STORAGE.preferences, preferences);
  }
});
app.addEventListener('change', event => {
  if (event.target.matches('#favor-weak')) {
    preferences.favorWeak = event.target.checked;
    saveStorage(STORAGE.preferences, preferences);
  }
});
document.addEventListener('click', event => {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) location.hash = `#${routeButton.dataset.route}`;
});
window.addEventListener('hashchange', () => { practice = null; render(); });
async function init() {
  preferences = { ...defaults, ...readStorage(STORAGE.preferences, {}) };
  try {
    const response = await fetch('data/catalog.php');
    if (!response.ok) throw new Error('Ne mogu da učitam predmete.');
    subjects = await response.json();
    if (!Array.isArray(subjects)) throw new Error('Spisak predmeta nije ispravan.');
  } catch (error) {
    app.innerHTML = `<section class="panel"><h2>Predmeti nisu učitani</h2><p class="lead">${escapeHtml(error.message)} Proveri da li je PHP omogućen na serveru.</p></section>`;
    return;
  }
  render();
}
init();
