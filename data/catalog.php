<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');

$subjects = [];
foreach (glob(__DIR__ . DIRECTORY_SEPARATOR . 'subjects' . DIRECTORY_SEPARATOR . '*.json') as $file) {
    $subject = json_decode(file_get_contents($file), true);
    if (!is_array($subject) || empty($subject['id']) || empty($subject['title'])) {
        continue;
    }

    $chapters = isset($subject['chapters']) && is_array($subject['chapters']) ? $subject['chapters'] : [];
    $itemCount = 0;
    foreach ($chapters as $chapter) {
        if (!isset($chapter['items']) || !is_array($chapter['items'])) {
            continue;
        }
        foreach ($chapter['items'] as $item) {
            if (!isset($item['enabled']) || $item['enabled'] !== false) {
                $itemCount++;
            }
        }
    }
    $subjects[] = [
        'id' => $subject['id'],
        'title' => $subject['title'],
        'description' => $subject['description'] ?? '',
        'icon' => $subject['icon'] ?? '📘',
        'chapterCount' => count($chapters),
        'itemCount' => $itemCount,
        'file' => 'data/subjects/' . basename($file),
    ];
}

echo json_encode($subjects, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
