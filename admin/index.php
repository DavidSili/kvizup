<?php
require_once dirname(__DIR__) . '/assets.php';
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'");
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
?>
<!doctype html>
<html lang="sr-Latn">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KvizUp · Uređivanje lekcija</title>
  <link rel="icon" type="image/svg+xml" href="../assets/images/favicon.svg">
  <link rel="stylesheet" href="../<?= asset_url('assets/css/style.css') ?>">
  <link rel="stylesheet" href="../<?= asset_url('assets/css/admin.css') ?>">
  <script src="../<?= asset_url('admin/admin.js') ?>" defer></script>
</head>
<body class="admin-body">
  <header class="admin-header"><a href="../">KvizUp</a><span>Uređivanje lekcija</span><span id="account"></span><button id="logout" hidden>Odjavi se</button></header>
  <p id="notice" role="status" aria-live="polite"></p>
  <main id="admin-app"><p>Učitavanje…</p></main>
  <dialog id="ai-dialog" aria-labelledby="ai-title">
    <form id="ai-form">
      <h2 id="ai-title">Napravi gradivo uz AI</h2>
      <p>Izaberi fotografije i napiši šta želiš da vežbaš. Predlog ćeš pregledati pre čuvanja.</p>
      <label>Naziv poglavlja<input name="title" required maxlength="200"></label>
      <label>ID poglavlja<input name="id" required pattern="[a-z0-9][a-z0-9_\-]{0,79}"></label>
      <label>Slike gradiva<input name="images[]" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
      <div id="image-previews"></div>
      <small>Do 8 slika, svaka do 5 MB, ukupno do 20 MB. Slike se šalju OpenAI-ju i ne čuvaju u aplikaciji.</small>
      <label>Instrukcije<textarea name="instructions" required maxlength="16000" rows="6" placeholder="Napravi kartice i test samo od zaokruženih zadataka. Preskoči zadatak 3. Odgovori neka budu kratki."></textarea></label>
      <fieldset><legend>Aktivnosti</legend>
        <label class="inline"><input type="checkbox" name="type" value="flashcards" checked> Kartice</label>
        <label class="inline"><input type="checkbox" name="type" value="choice-quiz" checked> Test sa izborom</label>
        <label class="inline"><input type="checkbox" name="type" value="text-quiz"> Test sa unosom</label>
        <p>Posebni izazovi — AI ih pravi kada u gradivu ima dovoljno odgovarajućih zadataka:</p>
        <label class="inline"><input type="checkbox" name="type" value="classification" checked> Razvrstavanje</label>
        <label class="inline"><input type="checkbox" name="type" value="matching" checked> Povezivanje pojmova</label>
        <label class="inline"><input type="checkbox" name="type" value="number" checked> Brojčani izazov</label>
        <label class="inline"><input type="checkbox" name="type" value="timeline" checked> Datumi i događaji</label>
        <label class="inline"><input type="checkbox" name="type" value="true-false" checked> Tačno / netačno</label>
      </fieldset>
      <div class="admin-actions"><button id="generate" type="submit">Napravi predlog</button><button type="button" id="close-ai">Zatvori</button></div>
    </form>
    <p id="ai-error" role="alert"></p>
    <section id="proposal" hidden></section>
  </dialog>
</body>
</html>
