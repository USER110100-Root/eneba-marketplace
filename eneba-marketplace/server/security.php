<?php
declare(strict_types=1);

function consumeAuthAttempts(PDO $db, string $route, string $ip, string $email, int $now): int {
    $rules = $route === 'login'
        ? [['login-ip', $ip, 30, 900], ['login-account', $email, 5, 900]]
        : ($route === 'chat' ? [['chat-ip', $ip, 10, 60]] : [['register-ip', $ip, 5, 3600]]);
    $db->exec('CREATE TABLE IF NOT EXISTS auth_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires INTEGER NOT NULL)');
    $db->exec('CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits(expires)');
    $db->exec('BEGIN IMMEDIATE');
    try {
        $db->prepare('DELETE FROM auth_limits WHERE expires <= ?')->execute([$now]);
        $read = $db->prepare('SELECT attempts, expires FROM auth_limits WHERE bucket = ?');
        $write = $db->prepare('INSERT INTO auth_limits VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1');
        foreach ($rules as [$scope, $identity, $limit, $window]) {
            $bucket = hash('sha256', $scope.':'.$identity);
            $read->execute([$bucket]);
            $previous = $read->fetch(PDO::FETCH_ASSOC);
            $read->closeCursor();
            if ($previous && $previous['attempts'] >= $limit) {
                $retry = max($retry ?? 0, $previous['expires'] - $now);
            }
            // Count rejected account attempts against the IP budget as well.
            if (!$previous || $previous['attempts'] < $limit) {
                $write->execute([$bucket, $now + $window]);
            }
        }
        $db->exec('COMMIT');
        return $retry ?? 0;
    } catch (Throwable $error) {
        $db->exec('ROLLBACK');
        throw $error;
    }
}
