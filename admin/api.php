<?php
declare(strict_types=1);
require __DIR__ . '/lib.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('display_errors', '0');
session_name('kvizup_admin');
session_start(['cookie_path' => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/', 'cookie_httponly' => true, 'cookie_samesite' => 'Strict', 'cookie_secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'), 'use_strict_mode' => true]);
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$action = $_GET['action'] ?? 'session';
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) fail('Osveži stranicu i pokušaj ponovo.', 403);
$body = [];
if ($method === 'POST' && str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    $raw = file_get_contents('php://input', false, null, 0, 2000001);
    if (strlen($raw) > 2000000) fail('Sadržaj je prevelik.', 413);
    $body = json_decode($raw, true);
    if (!is_array($body)) fail('Neispravan JSON.');
}
function respond(array $data): never { echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function user_hash(string $user): string { return in_array($user, ['sara', 'david'], true) ? env_value('ADMIN_' . strtoupper($user) . '_PASSWORD_HASH') : ''; }
try {
    if ($action === 'login' && $method === 'POST') {
        $user = strtolower(trim((string)($body['username'] ?? '')));
        $password = (string)($body['password'] ?? '');
        $rateFile = private_dir() . '/login-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local');
        $handle = fopen($rateFile, 'c+');
        if (!$handle || !flock($handle, LOCK_EX)) throw new RuntimeException('Prijava trenutno nije dostupna.');
        try {
            $attempts = array_values(array_filter(json_decode(stream_get_contents($handle), true) ?: [], fn($time) => $time > time() - 900));
            if (count($attempts) >= 10) fail('Previše pokušaja. Pokušaj ponovo za 15 minuta.', 429);
            $hash = user_hash($user);
            $ok = $hash !== '' && password_verify($password, $hash);
            if (!$ok) $attempts[] = time(); else $attempts = [];
            ftruncate($handle, 0); rewind($handle); fwrite($handle, json_encode($attempts));
        } finally { flock($handle, LOCK_UN); fclose($handle); }
        if (!$ok) fail('Korisničko ime ili lozinka nisu ispravni.', 401);
        session_regenerate_id(true);
        $_SESSION = ['user' => $user, 'hash' => hash('sha256', $hash), 'csrf' => bin2hex(random_bytes(32)), 'last' => time()];
    }
    $user = $_SESSION['user'] ?? '';
    if ($user && (time() - ($_SESSION['last'] ?? 0) > 7200 || !hash_equals($_SESSION['hash'] ?? '', hash('sha256', user_hash($user))))) { unset($_SESSION['user']); $user = ''; }
    if ($action === 'session' || $action === 'login') respond(['user' => $user, 'csrf' => $_SESSION['csrf'], 'aiReady' => env_value('OPENAI_API_KEY') !== '']);
    if (!$user) fail('Prijavi se da nastaviš.', 401);
    $_SESSION['last'] = time();
    if ($action === 'logout' && $method === 'POST') { $_SESSION = []; session_destroy(); respond(['ok' => true]); }
    if ($action === 'subjects' && $method === 'GET') {
        $subjects = [];
        foreach (glob(dirname(__DIR__) . '/data/subjects/*.json') as $file) {
            $raw = file_get_contents($file);
            $subject = json_decode($raw, true);
            if (is_array($subject)) $subjects[] = ['subject' => $subject, 'revision' => hash('sha256', $raw)];
        }
        respond(['subjects' => $subjects]);
    }
    if (in_array($action, ['save', 'delete'], true) && $method === 'POST') {
        $id = $body['id'] ?? '';
        if (!valid_id($id)) fail('Neispravan ID.');
        if ($action === 'save') {
            if (!is_array($body['subject'] ?? null)) fail('Nedostaje predmet.');
            validate_subject($body['subject']);
            if ($body['subject']['id'] !== $id) fail('ID postojećeg predmeta ne može da se menja.');
        }
        $result = with_content_lock(function() use ($id, $body, $action) {
            $file = subject_path($id);
            $old = is_file($file) ? file_get_contents($file) : null;
            $revision = $old === null ? null : hash('sha256', $old);
            if (($body['revision'] ?? null) !== $revision) fail('Predmet je u međuvremenu promenjen. Sačuvaj svoj nacrt i ponovo učitaj podatke.', 409);
            if ($old !== null) backup_content($file, $old);
            if ($action === 'delete') {
                if ($old === null) fail('Predmet ne postoji.', 404);
                if (!unlink($file)) throw new RuntimeException('Brisanje nije uspelo.');
                return ['ok' => true];
            }
            $raw = json_encode($body['subject'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
            $temporary = tempnam(dirname($file), '.save-');
            try {
                // tempnam creates mode 0600. Shared hosting may run PHP and
                // Apache as different users; public lesson JSON must be readable.
                if (!$temporary || file_put_contents($temporary, $raw) === false || !chmod($temporary, 0644) || !rename($temporary, $file)) throw new RuntimeException('Čuvanje nije uspelo. Proveri dozvole data/subjects foldera.');
            } finally { if ($temporary && is_file($temporary)) unlink($temporary); }
            return ['revision' => hash('sha256', $raw)];
        });
        respond($result);
    }
    if ($action === 'generate' && $method === 'POST') {
        require __DIR__ . '/ai.php';
        respond(generate_chapter());
    }
    fail('Nepoznata operacija.', 404);
} catch (InvalidArgumentException $error) { fail($error->getMessage()); }
catch (Throwable $error) { error_log('KvizUp admin error: ' . get_class($error)); fail('Operacija nije uspela. Proveri konfiguraciju i dozvole servera.', 500); }
