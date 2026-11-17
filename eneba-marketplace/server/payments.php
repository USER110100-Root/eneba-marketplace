<?php
declare(strict_types=1);

function stripeRequest(array $parameters, string $key): array {
    $secret = trim(getenv('STRIPE_SECRET_KEY') ?: '');
    if (!preg_match('/^sk_test_[A-Za-z0-9]{16,}$/', $secret)) throw new RuntimeException('Stripe sandbox key is missing or incomplete. Set the full STRIPE_SECRET_KEY in Render Environment Variables.');
    $context = stream_context_create(['http'=>[
        'method'=>'POST', 'timeout'=>15, 'ignore_errors'=>true,
        'header'=>"Authorization: Bearer ".$secret."\r\nContent-Type: application/x-www-form-urlencoded\r\nIdempotency-Key: ".$key,
        'content'=>http_build_query($parameters),
    ]]);
    $raw = file_get_contents('https://api.stripe.com/v1/checkout/sessions', false, $context);
    $data = $raw === false ? [] : json_decode($raw, true);
    if (isset($data['error'])) {
        $type = $data['error']['type'] ?? 'unknown';
        $code = $data['error']['code'] ?? 'unknown';
        $param = $data['error']['param'] ?? '';
        $message = preg_replace('/(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9]+/', '[redacted key]', (string)($data['error']['message'] ?? ''));
        error_log('Stripe checkout rejected: '.json_encode(['type'=>$type,'code'=>$code,'param'=>$param,'message'=>substr($message,0,600)]));
        if ($type === 'authentication_error') throw new RuntimeException('Stripe rejected the sandbox key. Replace STRIPE_SECRET_KEY with a valid full sk_test_ key.');
        if ($type === 'idempotency_error') throw new RuntimeException('Checkout retry parameters changed. Remove and re-add the cart items, then retry.');
        throw new RuntimeException('Stripe rejected checkout configuration. Check the Render logs for the error code and parameter.');
    }
    if ($raw === false) throw new RuntimeException('Could not reach Stripe. Please retry shortly.');
    if (empty($data['id']) || empty($data['url']) || ($data['livemode'] ?? true)) throw new RuntimeException('Stripe sandbox checkout is unavailable. Please retry.');
    return $data;
}

function verifiedStripeEvent(string $raw, string $signature, string $secret): array {
    if (!$secret) throw new RuntimeException('Webhook unavailable');
    preg_match('/(?:^|,)t=(\d+)/', $signature, $match);
    $timestamp = $match[1] ?? '';
    preg_match_all('/(?:^|,)v1=([a-f0-9]{64})/', $signature, $signatures);
    if (!$timestamp || abs(time()-(int)$timestamp)>300) throw new RuntimeException('Invalid signature');
    $expected = hash_hmac('sha256', $timestamp.'.'.$raw, $secret);
    if (!array_filter($signatures[1], fn($s)=>hash_equals($expected,$s))) throw new RuntimeException('Invalid signature');
    $event = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    if (($event['livemode'] ?? true) !== false) throw new RuntimeException('Sandbox events only');
    return $event;
}

function fulfillStripe(PDO $db, array $event): void {
    $session = $event['data']['object'];
    if (in_array($event['type'], ['checkout.session.expired','checkout.session.async_payment_failed'], true)) {
        $status=$event['type']==='checkout.session.expired'?'expired':'failed';
        $db->prepare("UPDATE checkout_attempts SET status=? WHERE id=? AND session_id=? AND status!='paid'")
            ->execute([$status,$session['metadata']['order_id'] ?? '',$session['id']]);
        return;
    }
    if (!in_array($event['type'], ['checkout.session.completed','checkout.session.async_payment_succeeded'], true)
        || ($session['payment_status'] ?? '') !== 'paid') return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $stmt=$db->prepare('SELECT * FROM checkout_attempts WHERE id=?');
        $stmt->execute([$session['metadata']['order_id'] ?? '']);
        $attempt=$stmt->fetch(PDO::FETCH_ASSOC);
        if (!$attempt || ($attempt['session_id'] && $attempt['session_id'] !== $session['id'])
            || $session['currency'] !== 'eur' || $session['amount_total'] !== (int)$attempt['total']) throw new RuntimeException('Payment mismatch');
        $order=json_decode($attempt['payload'],true);
        foreach ($order['items'] as &$item) $item['key']='DEMO-'.strtoupper(bin2hex(random_bytes(6)));
        unset($item);
        $order['status']='paid';
        $db->prepare('INSERT OR IGNORE INTO orders VALUES (?,?,?,?)')->execute([$attempt['id'],$attempt['user_id'],json_encode($order),$order['created']]);
        $db->prepare("UPDATE checkout_attempts SET status='paid',session_id=? WHERE id=?")->execute([$session['id'],$attempt['id']]);
        $db->exec('COMMIT');
    } catch (Throwable $e) { $db->exec('ROLLBACK'); throw $e; }
}

function checkoutRoutes(PDO $db, string $path, string $method, array $input, array $byId): void {
    if (!str_starts_with($path,'/api/checkout')) return;
    if (!isset($_SESSION['user'])) respond(['error'=>'Sign in to checkout'],401);
    if ($method === 'GET' && $path === '/api/checkout/status') {
        $stmt=$db->prepare('SELECT id,status FROM checkout_attempts WHERE id=? AND user_id=?');
        $stmt->execute([is_string($_GET['id'] ?? null)?$_GET['id']:'',$_SESSION['user']]);
        $attempt=$stmt->fetch(PDO::FETCH_ASSOC);
        if (!$attempt) respond(['error'=>'Order unavailable'],404);
        $stmt=$db->prepare('SELECT payload FROM orders WHERE id=? AND user_id=?');
        $stmt->execute([$attempt['id'],$_SESSION['user']]);
        respond(['status'=>$attempt['status'],'order'=>json_decode($stmt->fetchColumn() ?: 'null',true)]);
    }
    if ($method !== 'POST' || $path !== '/api/checkout') respond(['error'=>'Method unavailable'],405);
    enforceWriteLimit($db,'orders',(string)$_SESSION['user']);
    $items=$input['items'] ?? null;
    $nonce=$input['nonce'] ?? null;
    if (!is_array($items) || !$items || count($items)>30 || !is_string($nonce) || !preg_match('/^[a-f0-9-]{36}$/',$nonce)) respond(['error'=>'Invalid cart'],422);
    $order=['id'=>substr(hash('sha256',$_SESSION['user'].':'.$nonce),0,20),'created'=>gmdate('c'),'total'=>0,'items'=>[]];
    $digital=false;
    foreach ($items as $item) {
        $product=is_array($item) && is_string($item['id'] ?? null)?($byId[$item['id']] ?? null):null;
        $offer=$product && is_int($item['offer'] ?? null)?(offers($product)[$item['offer']-1] ?? null):null;
        if (!$offer || ($product['available'] ?? true) === false || ($offer['available'] ?? true) === false) respond(['error'=>'An offer is unavailable'],422);
        foreach (['sellerId','price','region','platform'] as $field) if (($item[$field] ?? null)!==$offer[$field]) respond(['error'=>'Offer changed. Review your cart.'],409);
        $digital=$digital || in_array($product['category'],['Games','Software'],true);
        $order['items'][]=['title'=>$product['title'],'productId'=>$product['id'],'seller'=>$offer['seller'],'platform'=>$offer['platform'],'region'=>$offer['region'],'price'=>$offer['price']];
        $order['total']+=$offer['price'];
    }
    if ($digital && ($input['immediateDeliveryConsent'] ?? false)!==true) respond(['error'=>'Confirm immediate digital delivery before continuing.'],422);
    $origin=rtrim(getenv('APP_URL') ?: '', '/');
    if (!preg_match('~^https?://[^/]+$~',$origin)) respond(['error'=>'Checkout is not configured'],503);
    $db->prepare('INSERT OR IGNORE INTO checkout_attempts(id,user_id,total,payload,status,consent) VALUES (?,?,?,?,?,?)')
        ->execute([$order['id'],$_SESSION['user'],$order['total'],json_encode($order),'pending',$digital?gmdate('c'):null]);
    $stmt=$db->prepare('SELECT * FROM checkout_attempts WHERE id=? AND user_id=?');$stmt->execute([$order['id'],$_SESSION['user']]);$attempt=$stmt->fetch(PDO::FETCH_ASSOC);
    $saved=json_decode($attempt['payload'],true);
    if ($saved['items']!==$order['items']) respond(['error'=>'Cart changed. Start checkout again.'],409);
    if ($attempt['status']==='paid') respond(['url'=>$origin.'/#/payment?id='.$order['id']]);
    if (in_array($attempt['status'], ['expired','failed'],true)) respond(['error'=>'Payment session ended. Remove and re-add the items to start a new checkout.'],409);
    if (!$attempt['url'] && strtotime($saved['created']) < time()-82800) respond(['error'=>'Checkout attempt expired. Remove and re-add the items.'],409);
    if ($attempt['url']) respond(['url'=>$attempt['url']]);
    $params=['mode'=>'payment','success_url'=>$origin.'/#/payment?id='.$order['id'],
        'cancel_url'=>$origin.'/#/checkout?cancelled=1','metadata'=>['order_id'=>$order['id']],
        'custom_text'=>['submit'=>['message'=>'Sandbox demo: no real money charged. All keys are fictional.']]];
    foreach ($saved['items'] as $item) $params['line_items'][]=['quantity'=>1,'price_data'=>['currency'=>'eur','unit_amount'=>$item['price'],'product_data'=>['name'=>$item['title'],'description'=>$item['seller'].' · '.$item['platform'].' · '.$item['region']]]];
    try { $session=stripeRequest($params,'checkout-'.$order['id']);
        $db->prepare('UPDATE checkout_attempts SET session_id=?,url=? WHERE id=?')->execute([$session['id'],$session['url'],$order['id']]);
        respond(['url'=>$session['url']]);
    } catch (Throwable $e) { respond(['error'=>$e->getMessage()],503); }
}
