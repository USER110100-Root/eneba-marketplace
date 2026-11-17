<?php
declare(strict_types=1);

function marketDatabasePath(): string {
    return getenv('MARKET_DB') ?: dirname(__DIR__).'/var/market.sqlite';
}

function openMarketDatabase(bool $readOnly = false): PDO {
    $db = new PDO('sqlite:'.marketDatabasePath(), null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::SQLITE_ATTR_OPEN_FLAGS => $readOnly ? PDO::SQLITE_OPEN_READONLY : PDO::SQLITE_OPEN_READWRITE | PDO::SQLITE_OPEN_CREATE,
    ]);
    $db->exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON');
    return $db;
}
