<?php

declare(strict_types=1);

function env_value(string $name, string $default = ''): string
{
    static $file = null;
    if ($file === null) {
        $file = [];
        $path = dirname(__DIR__) . '/.env';
        foreach (is_file($path) ? file($path, FILE_IGNORE_NEW_LINES) : [] as $line) {
            if (preg_match('/^([A-Z][A-Z0-9_]*)=(.*)$/', trim($line), $match)) {
                $file[$match[1]] = trim($match[2], " \t\r\n\"'");
            }
        }
    }
    $value = getenv($name);
    return $value !== false ? $value : ($file[$name] ?? $default);
}

function admin_users(): array
{
    $users = array_map(fn($user) => strtolower(trim($user)), explode(',', env_value('ADMIN_USERNAMES')));
    return array_values(array_unique(array_filter($users, fn($user) => preg_match('/^[a-z][a-z0-9_]{0,39}$/D', $user) === 1)));
}

function private_dir(): string
{
    $path = env_value('KVIZUP_PRIVATE_DIR', sys_get_temp_dir() . '/kvizup-' . substr(hash('sha256', __DIR__), 0, 12));
    if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
        throw new RuntimeException('Privatno skladište nije dostupno.');
    }
    return $path;
}

function fail(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function valid_id(mixed $id): bool
{
    return is_string($id) && preg_match('/^[a-z0-9][a-z0-9_-]{0,79}$/D', $id) === 1;
}

function require_text(mixed $value, string $label, int $max = 5000): void
{
    if (!is_string($value) || trim($value) === '' || strlen($value) > $max) {
        throw new InvalidArgumentException("Neispravno polje: $label.");
    }
}

function validate_subject(array $subject): void
{
    if (!valid_id($subject['id'] ?? null)) {
        throw new InvalidArgumentException('ID predmeta mora sadržati mala slova, brojeve, crtice ili donje crte.');
    }
    require_text($subject['title'] ?? null, 'naziv predmeta', 200);
    if (
        !isset($subject['chapters'])
        || !is_array($subject['chapters'])
        || !array_is_list($subject['chapters'])
        || count($subject['chapters']) > 100
    ) {
        throw new InvalidArgumentException('Neispravan spisak poglavlja.');
    }
    $chapterIds = [];
    foreach ($subject['chapters'] as $chapter) {
        if (!is_array($chapter) || !valid_id($chapter['id'] ?? null) || in_array($chapter['id'], $chapterIds, true)) {
            throw new InvalidArgumentException('Poglavlja moraju imati jedinstvene ID-jeve.');
        }
        $chapterIds[] = $chapter['id'];
        require_text($chapter['title'] ?? null, 'naziv poglavlja', 200);
        if (
            isset($chapter['imageDirectory'])
            && (
                !is_string($chapter['imageDirectory'])
                || !preg_match('#^assets/images/[a-zA-Z0-9_/-]+$#D', $chapter['imageDirectory'])
                || str_contains($chapter['imageDirectory'], '..')
            )
        ) {
            throw new InvalidArgumentException('Slike moraju biti u assets/images/.');
        }
        foreach ($chapter as $set => $pool) {
            if (!is_array($pool) || $set === 'activities') {
                continue;
            }
            if (!array_is_list($pool) || count($pool) > 1000) {
                throw new InvalidArgumentException('Neispravan skup zadataka.');
            }
            $ids = [];
            foreach ($pool as $record) {
                if (!is_array($record)) {
                    throw new InvalidArgumentException('Zadatak mora biti objekat.');
                }
                if (isset($record['id'])) {
                    if (!valid_id($record['id']) || in_array($record['id'], $ids, true)) {
                        throw new InvalidArgumentException("Duplikat ili neispravan ID u skupu $set.");
                    }
                    $ids[] = $record['id'];
                }
                foreach (['image', 'referenceImage'] as $key) {
                    if (
                        isset($record[$key])
                        && (
                            !is_string($record[$key])
                            || !preg_match('/^[a-zA-Z0-9_.-]+$/D', $record[$key])
                            || str_contains($record[$key], '..')
                        )
                    ) {
                        throw new InvalidArgumentException('Neispravno ime slike.');
                    }
                }
            }
        }
        if (!isset($chapter['activities']) || !is_array($chapter['activities']) || !array_is_list($chapter['activities'])) {
            throw new InvalidArgumentException('Aktivnosti moraju biti lista.');
        }
        $activityIds = [];
        foreach ($chapter['activities'] as $activity) {
            if (!is_array($activity) || !valid_id($activity['id'] ?? null) || in_array($activity['id'], $activityIds, true)) {
                throw new InvalidArgumentException('Aktivnosti moraju imati jedinstvene ID-jeve.');
            }
            $activityIds[] = $activity['id'];
            require_text($activity['title'] ?? null, 'naziv aktivnosti', 200);
            $type = $activity['type'] ?? '';
            if (!in_array($type, ['flashcards', 'text-quiz', 'choice-quiz'], true)) {
                throw new InvalidArgumentException('Nepodržan tip aktivnosti.');
            }
            if (
                isset($activity['questionCount'])
                && (
                    !is_int($activity['questionCount'])
                    || $activity['questionCount'] < 1
                    || $activity['questionCount'] > 50
                )
            ) {
                throw new InvalidArgumentException('Broj pitanja mora biti od 1 do 50.');
            }
            $pool = $chapter[$activity['itemSet'] ?? 'items'] ?? null;
            if (!is_array($pool)) {
                throw new InvalidArgumentException('Aktivnost koristi nepostojeći skup pitanja.');
            }
            if (isset($activity['itemIds'])) {
                $ids = $activity['itemIds'];
                if (!is_array($ids) || !array_is_list($ids) || !$ids || count(array_unique($ids, SORT_REGULAR)) !== count($ids)) {
                    throw new InvalidArgumentException('Neispravan izbor zadataka aktivnosti.');
                }
                foreach ($ids as $id) {
                    if (!is_string($id) || !in_array($id, array_column($pool, 'id'), true)) {
                        throw new InvalidArgumentException('Aktivnost koristi nepostojeći zadatak.');
                    }
                }
                $pool = array_filter($pool, fn ($record) => in_array($record['id'] ?? null, $ids, true));
            }
            foreach ($pool as $record) {
                if (($record['enabled'] ?? true) === false) {
                    continue;
                }
                $front = $type === 'flashcards' ? ($activity['frontField'] ?? 'question') : ($activity['promptField'] ?? ($type === 'choice-quiz' ? 'prompt' : 'question'));
                $back = $type === 'flashcards' ? ($activity['backField'] ?? 'answer') : ($activity['answerField'] ?? 'answer');
                require_text($record[$front] ?? null, "pitanje ($front)");
                require_text($record[$back] ?? null, "odgovor ($back)");
                if ($type === 'choice-quiz') {
                    $choices = $record['choices'] ?? null;
                    // Older matching banks have more options (and one legacy record has only one).
                    if (
                        !is_array($choices)
                        || !array_is_list($choices)
                        || count($choices) < 1
                        || count($choices) > 20
                        || count(array_unique($choices, SORT_REGULAR)) !== count($choices)
                        || !in_array($record[$back], $choices, true)
                    ) {
                        throw new InvalidArgumentException('Ponuđeni odgovori moraju biti različiti i sadržati tačan odgovor.');
                    }
                    foreach ($choices as $choice) {
                        require_text($choice, 'ponuđeni odgovor');
                    }
                }
            }
        }
    }
}

function subject_path(string $id): string
{
    if (!valid_id($id)) {
        throw new InvalidArgumentException('Neispravan ID predmeta.');
    }
    foreach (glob(dirname(__DIR__) . '/data/subjects/*.json') as $file) {
        $subject = json_decode(file_get_contents($file), true);
        if (($subject['id'] ?? null) === $id) {
            return $file;
        }
    }
    return dirname(__DIR__) . '/data/subjects/' . $id . '.json';
}

// Shared lock covers duplicate IDs, optimistic concurrency and atomic writes.

function with_content_lock(callable $operation): mixed
{
    $lock = fopen(private_dir() . '/content.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX)) {
        throw new RuntimeException('Sadržaj je trenutno zauzet.');
    }
    try {
        return $operation();
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function backup_content(string $file, string $content): void
{
    $folder = private_dir() . '/backups';
    if (!is_dir($folder)) {
        mkdir($folder, 0700, true);
    }
    if (
        file_put_contents($folder . '/' . basename($file) . '.' . gmdate('Ymd-His') . '-' . bin2hex(random_bytes(4)), $content, LOCK_EX) === false
    ) {
        throw new RuntimeException('Rezervna kopija nije sačuvana.');
    }
}
