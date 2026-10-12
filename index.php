<?php
require_once __DIR__ . '/assets.php';
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="sr-Latn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#f5f2e9">
  <meta name="description" content="Izaberi predmet, poglavlje i način vežbanja.">
  <title>KvizUp · Učenje po tvom ritmu</title>
  <link rel="icon" type="image/svg+xml" href="assets/images/favicon.svg">
  <link rel="stylesheet" href="<?= asset_url('assets/css/style.css') ?>">
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="#home" aria-label="KvizUp, početna strana">
        <span class="brand-mark">Q</span>
        <span><strong>KvizUp</strong><small>Uči. Vežbaj. Napreduj.</small></span>
      </a>
      <button class="icon-button" data-route="settings" aria-label="Podešavanja" title="Podešavanja">⚙</button>
    </header>
    <main id="app" class="page" data-mode="home" aria-live="polite"></main>
    <nav class="bottom-nav" aria-label="Glavna navigacija">
      <a href="#home" data-nav="home"><span>⌂</span>Predmeti</a>
      <a href="#report" data-nav="report"><span>▤</span>Izveštaj</a>
      <a href="#settings" data-nav="settings"><span>⚙</span>Podešavanja</a>
    </nav>
  </div>
  <script src="<?= asset_url('app.js') ?>"></script>
</body>
</html>
