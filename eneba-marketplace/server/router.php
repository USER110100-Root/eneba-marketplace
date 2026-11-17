<?php
declare(strict_types=1);
if (getenv('APP_ENV') !== 'development') ini_set('display_errors', '0');
require __DIR__.'/catalog.php';
require __DIR__.'/security.php';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (!str_starts_with($path, '/api/')) return false;
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function respond(mixed $data, int $status = 200): never {
    http_response_code($status);
    echo json_encode($data, JSON_THROW_ON_ERROR);
    exit;
}
require __DIR__.'/database.php';
$method = $_SERVER['REQUEST_METHOD'];
$publicRead = $method === 'GET' && (in_array($path, ['/api/home', '/api/catalog', '/api/products'], true)
    || str_starts_with($path, '/api/products/'));
if (!$publicRead && $path !== '/api/chat') {
    $secureSetting = getenv('SESSION_COOKIE_SECURE');
    $cookieSecure = $secureSetting === false
        ? getenv('APP_ENV') !== 'development'
        : filter_var($secureSetting, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;
    session_start([
        'use_strict_mode' => 1, 'use_only_cookies' => 1,
        'cookie_path' => '/', 'cookie_httponly' => true,
        'cookie_samesite' => 'Strict', 'cookie_secure' => $cookieSecure,
    ]);
}
try {
    $db = openMarketDatabase($publicRead);
    $db->query('SELECT id FROM products LIMIT 1')->closeCursor();
} catch (PDOException) {
    respond(['error' => 'Marketplace database is unavailable.'], 503);
}
$catalog = catalogSeed();
$products = array_map(fn($row)=>json_decode($row['payload'],true),$db->query('SELECT payload FROM products ORDER BY position')->fetchAll());
$webCovers = json_decode(file_get_contents(__DIR__.'/web-covers.json'), true, 512, JSON_THROW_ON_ERROR);
$seedArtwork = array_column($catalog, 'art', 'id');
foreach ($products as &$product) {
    $product['cashback'] = str_ireplace('cashback', 'cashback', $product['cashback'] ?? '');
    if (empty($product['art'])) $product['art'] = $seedArtwork[$product['id']] ?? '';
    $webCover = $webCovers[$product['id']] ?? null;
    if ($webCover) {
        $product['fallbackArt'] = $product['art'];
        $product['art'] = $webCover;
    }
}
unset($product);
$byId = array_column($products, null, 'id');
$input = [];
if ($method === 'POST') {
    if (!str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) respond(['error'=>'JSON required'],415);
    $input = json_decode(file_get_contents('php://input', false, null, 0, 65536),true);
    if (!is_array($input)) respond(['error'=>'Invalid request'],400);
}
if ($path === '/api/chat' && $method === 'POST') {
    require __DIR__.'/chat.php';
    marketplaceChat($input, $products, $db);
}
function enforceWriteLimit(PDO $db, string $route, string $identity): void {
    $retry = consumeAuthAttempts($db, $route, $_SERVER['REMOTE_ADDR'] ?? 'unknown', $identity, time());
    if ($retry > 0) {
        header('Retry-After: '.$retry);
        respond(['error' => 'Too many requests. Try again later.'], 429);
    }
}
if ($path === '/api/home' && $method === 'GET') respond(homepage($products, ($_GET['locale'] ?? '') === 'lt' ? 'lt' : 'en'));
if ($path === '/api/catalog' && $method === 'GET') respond(['products'=>$products,'offers'=>array_map('offers',$byId),'details'=>productDetails()]);
if ($path === '/api/products' && $method === 'GET') {
    foreach (['q', 'collection', 'platform', 'region', 'category', 'max', 'sort'] as $field) {
        if (array_key_exists($field, $_GET) && !is_string($_GET[$field])) {
            respond(['error' => 'Invalid search parameter: '.$field], 400);
        }
    }
    if (isset($_GET['collection'])) $products = collectionProducts($products,$_GET['collection']);
    $query = strtolower(trim(substr((string)($_GET['q'] ?? ''),0,120)));
    $results = array_filter($products,function ($p) use ($query) {
        foreach (['platform','region','category'] as $key) {
            if ($key === "category" && ($_GET[$key] ?? null) === "eGift Cards" && $p[$key] === "Gaming eCards") continue;
            if (!empty($_GET[$key]) && $_GET[$key] !== $p[$key]) return false;
        }
        if (isset($_GET['max']) && is_numeric($_GET['max']) && $p['price'] > (float)$_GET['max']*100) return false;
        $title = strtolower($p['title']);
        if ($query === '' || str_contains($title,$query)) return true;
        foreach (preg_split('/\s+/', $query) as $term) {
            $match = false;
            foreach (preg_split('/\s+/', $title) as $word) {
                if (str_starts_with($word,$term) || (strlen($term)>=3 && levenshtein($word,$term)<=1)) $match = true;
            }
            if (!$match) return false;
        }
        return true;
    });
    if (in_array($_GET['sort'] ?? '', ['asc','desc'],true)) usort($results,fn($a,$b)=>($_GET['sort']==='asc'?1:-1)*($a['price']<=>$b['price']));
    respond(array_values($results));
}
if (preg_match('~^/api/products/([a-z0-9-]+)$~',$path,$matches) && $method === 'GET') {
    $p = $byId[$matches[1]] ?? null;
    if (!$p) respond(['error'=>'Product unavailable'],404);
    respond(['product'=>$p,'offers'=>offers($p),'details'=>productDetails()[$p['id']] ?? null]);
}
if ($path === '/api/session' && $method === 'GET') respond(['email'=>$_SESSION['email'] ?? null]);
if ($path === '/api/logout' && $method === 'POST') {
    $_SESSION = [];
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 3600, 'path' => $cookie['path'], 'domain' => $cookie['domain'],
        'secure' => $cookie['secure'], 'httponly' => $cookie['httponly'], 'samesite' => $cookie['samesite'],
    ]);
    session_destroy();
    respond(['email'=>null]);
}
if (in_array($path,['/api/login','/api/register','/api/newsletter'],true) && $method === 'POST') {
    $rawEmail = $input['email'] ?? null;
    $email = is_string($rawEmail) && strlen($rawEmail) <= 254
        ? filter_var(strtolower(trim($rawEmail)), FILTER_VALIDATE_EMAIL) : false;
    if (!$email) respond(['error'=>'Enter a valid email address'],422);
    if ($path === '/api/newsletter') {
        enforceWriteLimit($db, 'newsletter', $email);
        respond(['message'=>'Demo signup complete. No email was saved.']);
    }
    $password = $input['password'] ?? null;
    if (!is_string($password) || strlen($password)<8 || strlen($password)>72 || str_contains($password, chr(0))) respond(['error'=>'Password must be 8–72 bytes'],422);
    $retry = consumeAuthAttempts($db, substr($path, 5), $_SERVER['REMOTE_ADDR'] ?? 'unknown', $email, time());
    if ($retry > 0) {
        header('Retry-After: '.$retry);
        respond(['error'=>'Too many attempts. Try again later.'],429);
    }
    if ($path === '/api/register') {
        $add = $db->prepare('INSERT OR IGNORE INTO users(email,hash) VALUES (?,?)');
        $add->execute([$email,password_hash($password,PASSWORD_DEFAULT)]);
        respond(['message'=>'If this address can be registered, you can now sign in.'],202);
    }
    $lookup = $db->prepare('SELECT * FROM users WHERE email=?');
    $lookup->execute([$email]);
    $user = $lookup->fetch();
    $dummyHash = $db->query("SELECT value FROM auth_config WHERE name='dummy_password_hash'")->fetchColumn();
    if (!is_string($dummyHash)) respond(['error'=>'Authentication is unavailable'],503);
    $verified = password_verify($password, $user ? $user['hash'] : $dummyHash);
    if (!$user || !$verified) respond(['error'=>'Email or password is incorrect'],401);
    session_regenerate_id(true);
    $_SESSION['user'] = $user['id'];
    $_SESSION['email'] = $email;
    respond(['email'=>$email]);
}
if ($path === '/api/orders') {
    if (!isset($_SESSION['user'])) respond(['error'=>'Sign in to access your orders'],401);
    if ($method === 'GET') {
        $rawPage = $_GET['page'] ?? '1';
        $page = is_string($rawPage) ? filter_var($rawPage, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 1000000],
        ]) : false;
        if ($page === false) respond(['error' => 'Invalid order history page'], 400);
        $statement = $db->prepare('SELECT payload FROM orders WHERE user_id=? ORDER BY created DESC, id DESC LIMIT 26 OFFSET ?');
        $statement->bindValue(1, $_SESSION['user'], PDO::PARAM_INT);
        $statement->bindValue(2, ($page - 1) * 25, PDO::PARAM_INT);
        $statement->execute();
        $rows = $statement->fetchAll();
        respond([
            'orders' => array_map(fn($row)=>json_decode($row['payload'],true), array_slice($rows, 0, 25)),
            'page' => $page,
            'hasMore' => count($rows) > 25,
        ]);
    }
    if ($method === 'POST') {
        enforceWriteLimit($db, 'orders', (string)$_SESSION['user']);
        $items = $input['items'] ?? [];
        $nonce = $input['nonce'] ?? '';
        if (!is_array($items) || !$items || count($items)>30 || !is_string($nonce) || !preg_match('/^[a-f0-9-]{36}$/',$nonce)) respond(['error'=>'Invalid order'],422);
        $id = substr(hash('sha256',$_SESSION['user'].':'.$nonce),0,20);
        $order = ['id'=>$id,'created'=>gmdate('c'),'total'=>0,'items'=>[]];
        foreach ($items as $item) {
            if (!is_array($item) || !is_string($item['id'] ?? null)
                || !is_int($item['offer'] ?? null) || $item['offer'] < 1) {
                respond(['error' => 'Invalid order item'], 422);
            }
            $product = $byId[$item['id']] ?? null;
            $offer = $product ? (offers($product)[$item['offer']-1] ?? null) : null;
            if ($offer && isset($item['sellerId']) && ($item['sellerId'] !== $offer['sellerId'] || ($item['price'] ?? null) !== $offer['price'] || ($item['region'] ?? null) !== $offer['region'] || ($item['platform'] ?? null) !== $offer['platform'])) respond(['error'=>'This offer changed. Remove it and select the current offer.'],409);
            if (!$offer) respond(['error'=>'An offer is unavailable'],422);
            $order['items'][] = ['title'=>$product['title'],'seller'=>$offer['seller'],'productId'=>$product['id'],'sellerId'=>$offer['sellerId'],'offerId'=>$offer['id'],'platform'=>$offer['platform'],'region'=>$offer['region'],'price'=>$offer['price'],'key'=>'DEMO-'.strtoupper(bin2hex(random_bytes(6)))];
            $order['total'] += $offer['price'];
        }
        $db->prepare('INSERT OR IGNORE INTO orders VALUES (?,?,?,?)')->execute([$id,$_SESSION['user'],json_encode($order),$order['created']]);
        $stmt = $db->prepare('SELECT payload FROM orders WHERE id=? AND user_id=?');
        $stmt->execute([$id,$_SESSION['user']]);
        respond(json_decode($stmt->fetchColumn(),true),201);
    }
}
respond(['error'=>'Endpoint not found'],404);
