<?php
declare(strict_types=1);

function asset_url(string $path): string {
    $root = __DIR__;
    $version = trim(file_get_contents($root . '/VERSION'));
    $hash = hash_file('sha256', $root . '/' . $path);
    return htmlspecialchars($path . '?v=' . rawurlencode($version) . '-' . substr($hash, 0, 16), ENT_QUOTES, 'UTF-8');
}
