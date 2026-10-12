# kvizup
An interactive learning app that helps students practice school subjects through quizzes, flashcards, educational games, and personalized tests.

## KvizUp

KvizUp is a mobile-first, data-driven study app with a three-level flow:

1. Choose a subject.
2. Choose a chapter.
3. Choose a learning activity or test.

The shared interface and activity engine live in `index.html`, `assets/css/style.css`, and `app.js`. Subject content lives in one JSON file per subject under `data/subjects/`. `data/catalog.php` discovers those JSON files automatically, so adding a subject does not require copying the app or editing the catalog endpoint.

### Run locally

Serve the folder through Apache/PHP, for example:

```text
http://localhost/MySite/kvizup/
```

The PHP endpoint is required to discover subject JSON files. Do not open `index.html` using a `file://` URL.

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

Application files are mounted read-only from your working folder. Edit them
normally in VS Code, then refresh the browser (Ctrl+F5 for cached assets).
After changing the Dockerfile, run `docker compose up --build -d` again.

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

### Add a subject

Copy `data/subjects/matematika.json`, give it a unique `id`, update its title and description, then define its `chapters`. Each chapter can contain `items`, `questions`, images, and an `activities` array. Available activity types are `flashcards`, `text-quiz`, and `choice-quiz`; use `itemSet` to point an activity at a chapter array such as `items` or `questions`.

See [data/README.md](data/README.md) for the full JSON schema and authoring checklist. Subject examples are [hemija.json](data/subjects/hemija.json), [matematika.json](data/subjects/matematika.json), [istorija.json](data/subjects/istorija.json), and [geografija.json](data/subjects/geografija.json).

### Verify

```powershell
node --check app.js
php -l data/catalog.php
```

Also validate the subject JSON with `JSON.parse`, open each subject/chapter/activity in a browser, complete a test, and confirm its result appears in the daily report.
