# kvizup
An interactive learning app that helps students practice school subjects through quizzes, flashcards, educational games, and personalized tests.

## KvizUp

KvizUp is a mobile-first, data-driven study app with a three-level flow:

1. Choose a subject.
2. Choose a chapter.
3. Choose a learning activity or test.

The shared interface and activity engine live in `index.html`, `style.css`, and `app.js`. Subject content lives in one JSON file per subject under `data/subjects/`. `data/catalog.php` discovers those JSON files automatically, so adding a subject does not require copying the app or editing the catalog endpoint.

### Run locally

Serve the folder through Apache/PHP, for example:

```text
http://localhost/MySite/kvizup/
```

The PHP endpoint is required to discover subject JSON files. Do not open `index.html` using a `file://` URL.

### Add a subject

Copy `data/subjects/matematika.json`, give it a unique `id`, update its title and description, then define its `chapters`. Each chapter can contain `items`, `questions`, images, and an `activities` array. Available activity types are `flashcards`, `text-quiz`, and `choice-quiz`; use `itemSet` to point an activity at a chapter array such as `items` or `questions`.

See [data/README.md](data/README.md) for the full JSON schema and authoring checklist. Subject examples are [hemija.json](data/subjects/hemija.json), [matematika.json](data/subjects/matematika.json), [istorija.json](data/subjects/istorija.json), and [geografija.json](data/subjects/geografija.json).

### Verify

```powershell
node --check app.js
php -l data/catalog.php
```

Also validate the subject JSON with `JSON.parse`, open each subject/chapter/activity in a browser, complete a test, and confirm its result appears in the daily report.
