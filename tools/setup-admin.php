<?php

declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
$path = dirname(__DIR__) . '/.env';
$content = is_file($path) ? file_get_contents($path) : file_get_contents(dirname(__DIR__) . '/.env.example');
require dirname(__DIR__) . '/admin/lib.php';
$users = admin_users();
if (!$users) {
    fwrite(STDERR, "Podesi ADMIN_USERNAMES u .env pre pokretanja ovog alata.\n");
    exit(1);
}
foreach ($users as $user) {
    // No passwords are placed in shell history or command-line arguments.
    fwrite(STDOUT, "Lozinka za $user (najmanje 12 znakova; unos u ovom terminalu je vidljiv): ");
    $password = trim(fgets(STDIN) ?: '');
    if (strlen($password) < 12) {
        fwrite(STDERR, "Lozinka je prekratka. Fajl nije promenjen.\n");
        exit(1);
    }
    $key = 'ADMIN_' . strtoupper($user) . '_PASSWORD_HASH';
    // Compose interpolates dollar signs in unquoted .env values.
    $line = $key . "='" . password_hash($password, PASSWORD_DEFAULT) . "'";
    $content = preg_match('/^' . $key . '=/m', $content) ? preg_replace_callback('/^' . $key . '=.*$/m', fn () => $line, $content) : $content . "\n$line\n";
}
if (file_put_contents($path, $content, LOCK_EX) === false) {
    fwrite(STDERR, "Ne mogu da sačuvam .env.\n");
    exit(1);
}
chmod($path, 0600);
fwrite(STDOUT, "Nalozi su podešeni u .env. API ključ upiši direktno u taj fajl.\n");
