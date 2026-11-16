<?php
declare(strict_types=1);
require __DIR__.'/../server/security.php';
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
function expect(int $actual, int $expected): void {
    if ($actual !== $expected) throw new RuntimeException("Expected $expected, received $actual");
}
for ($i=0; $i<5; $i++) expect(consumeAuthAttempts($db,'login','ip-a','demo@example.test',100),0);
expect(consumeAuthAttempts($db,'login','ip-b','demo@example.test',101),899);
expect(consumeAuthAttempts($db,'login','ip-b','demo@example.test',1000),0);
for ($i=0; $i<30; $i++) expect(consumeAuthAttempts($db,'login','ip-c',"demo$i@example.test",2000),0);
expect(consumeAuthAttempts($db,'login','ip-c','other@example.test',2001),899);
for ($i=0; $i<5; $i++) expect(consumeAuthAttempts($db,'register','ip-d',"demo$i@example.test",3000),0);
expect(consumeAuthAttempts($db,'register','ip-d','other@example.test',3001),3599);
expect(consumeAuthAttempts($db,'register','ip-e','other@example.test',3001),0);
echo "PASS: account limit, IP limit, registration limit, independent IP, and expiration\n";
