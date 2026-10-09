# Subject data guide

KvizUp separates reusable application logic from lesson content. Keep one UTF-8 JSON file per school subject in `data/subjects/`. The `catalog.php` endpoint discovers every valid subject file; do not add a hardcoded subject list to `app.js` or copy the app for each subject.

## Subject shape

```json
{
  "id": "biology",
  "title": "Biologija",
  "description": "Kratak opis predmeta.",
  "icon": "🌱",
  "chapters": []
}
```

`id` must be unique and stable because it appears in URLs and localStorage keys. `title`, `description`, and `icon` are shown in the subject picker. Add chapters inside the subject JSON.

## Chapter shape

```json
{
  "id": "cells",
  "title": "Ćelija",
  "description": "Građa i uloga ćelije.",
  "icon": "◉",
  "imageDirectory": "assets/biology",
  "imageField": "image",
  "items": [],
  "questions": [],
  "activities": []
}
```

- `id` is unique within its subject and should remain stable after publishing.
- `items` is the default pool for cards and questions. Fields are activity-specific, for example `question`, `answer`, `name`, `symbol`, `description`, `image`, and `enabled`.
- `questions` or another named array can hold a separate question pool.
- `enabled: false` omits one record from activities that use the pool.
- Give each record a stable, unique `id` to keep learning statistics associated with the correct concept.
- `imageDirectory` is a URL path relative to the KvizUp application root (the folder containing `index.html`), not relative to the JSON file. The default is `images`.
- `imageField` names the record field containing an image filename; its default is `image`.
- `referenceImage` names a source-page image and appears as a link. Verify every referenced asset exists.

## Activity types

Each chapter's `activities` array controls what learners can start and in what order.

### Flashcards

```json
{
  "id": "term-cards",
  "type": "flashcards",
  "title": "Kartice",
  "description": "Poveži pojam i objašnjenje.",
  "frontField": "question",
  "backField": "answer",
  "itemSet": "items",
  "imageOn": "back",
  "descriptionField": "description"
}
```

The front and back fields refer to properties on records in the selected pool. `itemSet` is optional and defaults to `items`. `imageOn` can be `front` or `back`.

### Text answer test

```json
{
  "id": "written-test",
  "type": "text-quiz",
  "title": "Test sa unosom",
  "description": "Upiši traženi odgovor.",
  "promptField": "question",
  "answerField": "answer",
  "answerLabel": "odgovor",
  "itemSet": "questions",
  "imageField": "image",
  "imageTiming": "after-answer",
  "questionCount": 10
}
```

`promptField` and `answerField` select the prompt and accepted answer. `itemSet` is optional. `imageTiming: "after-answer"` reveals an illustration after checking the answer. Text answers are checked after whitespace removal and Serbian Latin diacritic normalization; use choices instead when an answer needs multiple valid spellings or close matching rules.

### Multiple choice

```json
{
  "id": "quick-check",
  "type": "choice-quiz",
  "title": "Brza provera",
  "description": "Izaberi tačan odgovor.",
  "itemSet": "questions",
  "questionCount": 10,
  "kindLabel": "Igra znanja"
}
```

Each selected record must contain `prompt`, a non-empty `choices` array, and `answer` whose value exactly matches one entry in `choices`. Optional fields include `referenceImage`, `sourceTask`, and `enabled`.

A missing activity `questionCount` uses the global preference (default 20). An activity-specific `questionCount` overrides the global preference. If a question pool is smaller than the test, questions may repeat.

## Images and source material

- Place image files under the KvizUp root at the path in `imageDirectory`.
- `image` is the record image shown inline when an activity requests it.
- `referenceImage` opens a source page in a separate tab; it is not an inline illustration.
- Never assume a filename's page number equals the printed page number. Inspect the images, preserve circled task numbers, and use only items the user selected.
- Check that excluded materials do not appear in either prompts or answer choices.

## Adding a subject checklist

1. Create `data/subjects/<unique-id>.json` using the subject shape above.
2. Add chapters, records, question banks, and activities to the same file.
3. Confirm subject and chapter IDs are unique and stable, and all activity fields exist in their records.
4. Parse the JSON, verify image references, and confirm every multiple-choice answer is in its choices array.
5. Open `http://localhost/MySite/kvizup/` through Apache/PHP. Confirm the subject appears, follow subject → chapter → activity, and complete a test.
6. Confirm the test appears in the daily report and that progress is scoped to the intended subject and chapter.
7. Do not clear unrelated localStorage keys during browser tests.

## Shared implementation

- `../app.js` contains navigation, shared activity renderers, scoring, reports, preferences, and category-specific learning statistics.
- `catalog.php` discovers subject files; it should not contain lesson content.
- `../style.css` and `../index.html` contain shared visual structure. Add a new activity renderer only once to the shared renderer registry; do not create a subject-specific app.
