# KvizUp 1.0.0
An interactive learning app that helps students practice school subjects through quizzes, flashcards, educational games, and personalized tests.

## KvizUp

KvizUp is a mobile-first, data-driven study app with a three-level flow:

1. Choose a subject.
2. Choose a chapter.
3. Choose a learning activity or test.

The shared interface and activity engine live in `index.php`, `assets/css/style.css`, and `app.js`. Subject content lives in one JSON file per subject under `data/subjects/`. `data/catalog.php` discovers those JSON files automatically, so adding a subject does not require copying the app or editing the catalog endpoint.

### Run locally

Serve the folder through Apache/PHP, for example:

```text
http://localhost/MySite/kvizup/
```

The PHP endpoint is required to discover subject JSON files. Do not open `index.php` using a `file://` URL.

### Run with Docker (Windows)

Docker is optional; WAMP remains supported. This setup uses PHP 8.4 and Apache
in one Linux container, with no database required.

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
   with the WSL 2 backend. If WSL is missing, run `wsl --install` in PowerShell
   as Administrator, restart Windows when requested, then run `wsl --update`.
   Hardware virtualization must be enabled.
2. Start Docker Desktop, use Linux containers, and wait for its engine to run.
3. Open a new PowerShell terminal:

```powershell
cd C:\wamp\www\MySite\kvizup
docker --version
docker compose version
docker compose up --build -d
```

Open **http://localhost:8080/**. The first build downloads the PHP/Apache image
and requires internet access. WAMP can stay running because Docker uses 8080.

Application code and assets are mounted read-only from your working folder;
subject data is writable so the admin panel can save changes. Edit files
normally in VS Code, then refresh the browser. JS/CSS content fingerprints
automatically invalidate cached assets, including on mobile devices.
After changing the Dockerfile, run `docker compose up --build -d` again.

If Windows/Docker serves an old or truncated HTML/JavaScript file after an
editor replaces a file, refresh the individual file mounts by running
`docker compose up -d --force-recreate web`, then refresh the browser.
This preserves subject data and the private volume.

```powershell
# Inspect the service and its logs
docker compose ps
docker compose logs -f web

# Stop and remove the container; source files remain
docker compose down

# Start again
docker compose up -d
```

Ctrl+C exits the log view without stopping the container. If 8080 is occupied,
change `127.0.0.1:8080:80` to `127.0.0.1:8081:80` in `compose.yaml`, run
`docker compose up -d`, and open http://localhost:8081/.
The port is bound to your computer's loopback interface for local development.

Learning progress stays in browser storage. The Docker URL has separate
storage from the WAMP URL, so existing WAMP results will not appear there.

Commit `Dockerfile`, `compose.yaml` and `.dockerignore` with the application.
The Dockerfile also includes application files in the image for running without
the development mounts. Publishing an image or deploying to a server is a
separate step; this Compose configuration is for local development.

### SCSS and automatic compilation

Edit **`styles/style.scss`**, not `assets/css/style.css`. Sass generates `assets/css/style.css`,
which the application continues to load. Commit both files and `package-lock.json`.
There is no automatic browser refresh; refresh manually after compilation.

#### Docker: application and watcher

Start Docker Desktop, then run from the project folder:

```powershell
cd C:\wamp\www\MySite\kvizup
docker compose --profile dev up --build -d
```

Open http://localhost:8080/. The `styles` service installs Sass and watches
SCSS changes, writing CSS into your local project. Node.js is not required on
Windows for this option. The first run needs internet access to download Node
and npm dependencies. Polling supports file changes from Windows bind mounts.

To enable the watcher when the application is already running:

```powershell
docker compose up -d styles
docker compose logs -f styles
```

Wait for Sass to report a successful compilation. Ctrl+C closes the log view
without stopping the watcher. To disable only the watcher:

```powershell
docker compose stop styles
```

To stop the application and watcher together:

```powershell
docker compose --profile dev down
```

Without the watcher, `docker compose up --build -d web` starts the app only.
The web image compiles SCSS during its build; the local development web service
serves your local `assets/css/style.css` through its existing mount. To regenerate that file
once without a persistent watcher:

```powershell
docker compose run --rm styles sh -c "npm ci --no-audit --no-fund && npm run styles:build"
```

#### WAMP or local Node.js

With Node.js/npm installed, keep WAMP running and execute:

```powershell
cd C:\wamp\www\MySite\kvizup
npm.cmd ci
npm.cmd run styles:watch
```

Keep this terminal open; Ctrl+C stops the watcher. Open the WAMP URL documented
above and refresh manually. For a one-time compilation, use
`npm.cmd run styles:build`. Run one watcher at a time (Docker or local Node).
If SCSS has a syntax error, check the watcher logs, fix it, and save again.

### Admin panel

Open **http://localhost:8080/admin/** (Docker) or
**http://localhost/MySite/kvizup/admin/** (WAMP). Configured accounts have the same
editing permissions. Public study pages remain available without login.

#### First setup

Copy `.env.example` to `.env` for a new installation. Configure the admin list:

```dotenv
ADMIN_USERNAMES=editor,parent
ADMIN_EDITOR_PASSWORD_HASH=
ADMIN_PARENT_PASSWORD_HASH=
```

Usernames are case-insensitive, use 1-40 ASCII letters, digits or underscores,
and start with a letter. Every listed user needs a matching
`ADMIN_<UPPERCASE_USERNAME>_PASSWORD_HASH`. Accounts omitted from the list cannot
sign in even if an old hash remains; removal invalidates their session on the
next request. No usernames are hardcoded or displayed on the login page.
An empty or missing list disables login. All accounts have equal permissions.

Enclose password hashes in single quotes in `.env`, for example
`ADMIN_EDITOR_PASSWORD_HASH='your-password-hash'`. This prevents Docker Compose
from treating dollar signs in a hash as environment variable references. The
setup helper writes this format automatically; PHP reads the original hash.

Create passwords for all listed accounts with the interactive helper:

```powershell
cd C:\wamp\www\MySite\kvizup
C:\wamp\bin\php\php8.3.17\php.exe tools/setup-admin.php
```

If PHP is on PATH, use `php tools/setup-admin.php`. Choose separate passwords
of at least 12 characters. The helper's terminal input is visible; run it in
a private terminal. Only password hashes are stored. It preserves an existing
OpenAI key. Run the helper again to change configured passwords; existing sessions
are invalidated after password changes.

The project includes `.env.example`; `.env` is ignored by Git and Docker builds.
If you clone the project elsewhere, copy `.env.example` to `.env` before starting
Docker. The development container mounts this file read-only. Do not commit it,
paste it into chat, or publish it as a downloadable asset.

For AI generation, edit `.env` locally:

```dotenv
OPENAI_API_KEY=your-private-api-key
OPENAI_MODEL=gpt-6-luna
```

The current deployment uses `gpt-6-luna`, configured through `OPENAI_MODEL`.
Set it explicitly: the code and `.env.example` currently default to `gpt-4.1-mini`.
No separate agent configuration is needed; PHP sends the instructions, images,
and strict JSON schema directly to the Responses API. For a restricted API key,
allow **Model capabilities > Responses: Write**; image generation and Files
permissions are not needed for this workflow.

Use an OpenAI API project with billing/credit configured; a ChatGPT subscription
does not configure this app's API access. The model is configurable and must
support image input, Responses API and structured JSON output. The key is used
only by PHP, never sent to the browser. AI generation makes a billable API call.

Rebuild/start the updated web service and watcher:

```powershell
docker compose --profile dev up --build -d
```

Sign in with a configured account and its chosen password. Without configured
hashes, login stays disabled; no default password is installed.

#### Editing and AI workflow

1. Select or create a subject, then select or create a chapter.
2. Edit names, cards, questions, choices, and activities. Activity fields refer
   to record fields; custom banks and advanced fields can be edited using the
   chapter JSON editor. IDs must be stable and unique within their scope.
3. Choose **Dodaj gradivo uz AI**. Add up to 8 JPEG/PNG/WebP photos (5 MB each,
   20 MB total), write instructions, and select the activity types.
4. The photos are sent to OpenAI for analysis. PHP uses temporary upload files;
   the app does not store book/notebook scans or commit them. The API request
   uses `store: false`; this is not a guarantee of zero provider retention.
   See [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).
5. Review activity titles and task counts, warnings, and factual corrections.
   AI may correct obvious errors in years, numbers, units, or names when confident;
   each correction reports the original value, corrected value, and reason.
   Uncertain facts are flagged rather than silently changed. Edit/delete any
   generated tasks before accepting the proposal.
   **Dodaj u poglavlje** appends the proposal to the local draft in separate banks
   and adds corresponding activities. Existing tasks and special mappings stay
   intact. This works for both empty and existing chapters.
6. Click **Sačuvaj predmet** to publish the reviewed draft to its subject JSON.
   Refresh study pages to load the updated catalog/content.

AI proposals are not auto-published. Drafts are held in browser memory, not
persisted across reloads. Use **Preuzmi JSON nacrt** before leaving if you need
to keep an unfinished draft. Confirmed subject deletion is immediate; chapter
and task deletions take effect when you save the subject.

Sessions expire after two hours of inactivity. Writes require a session and
CSRF token. Concurrent edits are detected using a revision hash: a stale save
is rejected instead of overwriting the other user's work. Export your draft
and reload to reconcile a conflict.

#### Storage and hosting

The Docker web service needs write access to `data/subjects/`; it mounts this
directory through `data/`, so admin edits persist in your working tree and show
up in `git diff`. Saving or deleting content does not commit or push to GitHub.
On a hosted server, data changes stay on that server until you export/sync them.

Before an overwrite or deletion, the server saves a private backup. Docker
stores backups and login rate-limit records in its `admin_private` volume under
`/var/lib/kvizup`. Do not use `docker compose down -v` if you need these backups.
On WAMP, private files default to a project-specific folder in PHP's system temp
directory; set `KVIZUP_PRIVATE_DIR` to a durable directory outside the web root
for lasting backups. Restore a backup by copying it back to the intended subject
JSON as the server administrator. Backups do not include passwords or source photos.

For WAMP/hosting, use PHP 8.1 or newer, enable PHP cURL and fileinfo and set upload limits to match
`docker/uploads.ini`. Ensure Apache honors the supplied `.htaccess`. Before
publishing, verify `/.env` returns **403** and use **HTTPS** for login. Keep
private storage outside the public web root. The Compose port remains local-only;
this change does not publish a site to the internet.

#### Uploading to shared hosting

Upload `index.php`, `assets.php`, `VERSION`, `.htaccess`, `app.js`, and the
`admin/`, `assets/`, and `data/` directories. The entry page is **`index.php`**;
missing it causes a directory-level 403 when listing is disabled. Old
`index.html` links redirect to the application root. Configure `.env` privately
on the server and do not upload development dependencies or private backups.

Enable Apache `mod_rewrite` and `mod_headers`, and allow the supplied `.htaccess`
rules. For a project in `/kvizup/`, the public URL is `/kvizup/` and the admin URL
is `/kvizup/admin/`.

Public lesson JSON files need permission **644**. Admin saving sets this mode
before and after atomic replacement, then checks public read permissions on
Linux. If a previously saved subject returns 403, set its existing JSON file to
644 in the hosting File Manager and upload the latest `admin/api.php` to prevent
recurrence. FTP upload permissions are controlled separately by the FTP client
and hosting configuration. Directories normally use 755; PHP must have write
access to `data/subjects/` through the correct owner or group.

#### Validation

```powershell
python tests/admin_integration.py --php C:\wamp\bin\php\php8.3.17\php.exe
node --check admin/admin.js
node tests/admin_submit.cjs
node tests/typed_answers.cjs
npm.cmd run styles:build
docker compose --profile dev config --quiet
```

The integration tests create isolated temporary accounts and subjects and check
authentication, CSRF, validation, conflicts, backups, CRUD and missing API setup.
They never modify your actual accounts or lesson files and make no paid API calls.
To verify live AI integration, configure your own key and request one small lesson
in the panel, review it, then save only if you want it published.

### Add a subject

Copy an existing file such as `data/subjects/geografija.json`, give it a unique `id`, update its title and description, then define its `chapters`. Each chapter can contain `items`, `questions`, images, and an `activities` array. Available activity types are `flashcards`, `text-quiz`, and `choice-quiz`; use `itemSet` to point an activity at a chapter array such as `items` or `questions`.

See [data/README.md](data/README.md) for the full JSON schema and authoring checklist. Subject examples are [hemija.json](data/subjects/hemija.json), [istorija.json](data/subjects/istorija.json), and [geografija.json](data/subjects/geografija.json).

### Verify

```powershell
node --check app.js
php -l data/catalog.php
```

Also validate the subject JSON with `JSON.parse`, open each subject/chapter/activity in a browser, complete a test, and confirm its result appears in the daily report.
### Thematic activities and typed answers

AI assigns cards and questions to meaningful subtopics. Each subtopic can have
its own flashcards and multiple-choice test; short lessons can remain a single
theme. Activities reference their question bank through `itemSet` and select
specific records through `itemIds`, so thematic activities do not reuse the
entire chapter indiscriminately. Existing activities are not automatically split.

Typed-answer tests are optional, even when selected. A theme needs at least
three unambiguous suitable answers, each at most three words and 32 characters.
Full sentences are excluded. If no theme qualifies, the proposal explains why
no typed-answer test was created.

Answer comparison ignores letter case, spaces, and Serbian Latin diacritics.
For alphabetic answers of at least five normalized letters, one insertion,
deletion, substitution, or adjacent-letter transposition is accepted. Numbers,
years, chemical symbols, and short words remain exact after normalization.
Accepted typos show the proper answer. This is a local spelling check, not
semantic grading, and makes no additional AI calls.

## Asset cache and app version

The app version is `1.0.0`, stored in `VERSION`. Public and admin pages generate JS/CSS URLs using the app version and a SHA-256 content fingerprint. Editing a file automatically changes its URL; no manual version bump or mobile cache clearing is needed. HTML is served with `Cache-Control: no-store`; JS/CSS must revalidate cached copies. Existing `index.html` links redirect to the app root. PHP and Apache rewrite/headers modules are required (enabled by the Dockerfile). After this change run `docker compose up --build -d web`.
