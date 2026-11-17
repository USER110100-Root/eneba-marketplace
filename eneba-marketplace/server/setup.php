<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/catalog.php';
require __DIR__.'/database.php';
$path = marketDatabasePath();
$directory = dirname($path);
if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
    throw new RuntimeException('Cannot create the database directory.');
}
if (!getenv('MARKET_DB') && !file_exists($path) && is_file(__DIR__.'/market.sqlite')) {
    $legacy = new PDO('sqlite:'.__DIR__.'/market.sqlite');
    $legacy->exec('VACUUM INTO '.$legacy->quote($path));
}
$db = openMarketDatabase();
$db->exec('CREATE TABLE IF NOT EXISTS products (position INTEGER PRIMARY KEY, id TEXT UNIQUE, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), payload TEXT NOT NULL, created TEXT NOT NULL)');
$db->exec('DROP TABLE IF EXISTS newsletter');
$db->exec('CREATE TABLE IF NOT EXISTS auth_config (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
if ($db->query("SELECT value FROM auth_config WHERE name='dummy_password_hash'")->fetchColumn() === false) {
    $db->prepare("INSERT OR IGNORE INTO auth_config VALUES ('dummy_password_hash', ?)")
        ->execute([password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT)]);
}

$seed = $db->prepare('INSERT OR IGNORE INTO products (position,id,payload) VALUES (NULL, ?, ?)');
$catalog = catalogSeed();
foreach ($catalog as $product) $seed->execute([$product['id'],json_encode($product)]);
echo "Marketplace database initialized.\n";
