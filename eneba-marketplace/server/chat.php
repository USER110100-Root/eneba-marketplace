<?php
declare(strict_types=1);

function marketplaceChat(array $input, array $products, PDO $db): never {
    $flag = getenv('CHAT_ENABLED');
    if (!filter_var($flag === false ? getenv('APP_ENV') === 'development' : $flag, FILTER_VALIDATE_BOOLEAN)) {
        respond(['error' => 'AI chat is currently unavailable.'], 503);
    }
    $validText = static fn($value): bool => is_string($value)
        && preg_match('/\A.{0,500}\z/us', $value) === 1;
    $question = $input['message'] ?? null;
    $locale = array_key_exists('locale', $input) ? $input['locale'] : 'en';
    $history = array_key_exists('history', $input) ? $input['history'] : [];
    if (!$validText($question) || trim($question) === ''
        || !in_array($locale, ['en', 'lt'], true)
        || !is_array($history) || !array_is_list($history) || count($history) > 6) {
        respond(['error' => 'Invalid chat message, history or locale.'], 400);
    }
    $messages = [];
    foreach ($history as $turn) {
        if (!is_array($turn) || !in_array($turn['role'] ?? null, ['user', 'assistant'], true)
            || !$validText($turn['content'] ?? null)) {
            respond(['error' => 'Invalid chat history entry.'], 400);
        }
        $messages[] = ['role' => $turn['role'], 'content' => $turn['content']];
    }
    $lithuanian = $locale === 'lt';
    $words = preg_split('/[^a-z0-9]+/', strtolower($question), -1, PREG_SPLIT_NO_EMPTY);
    $terms = array_values(array_diff($words, [
        'what', 'is', 'the', 'price', 'prices', 'how', 'much', 'does', 'cost', 'a', 'an', 'for', 'of', 'my', 'please',
    ]));
    $matches = $terms ? array_filter($products, static function (array $product) use ($terms): bool {
        $title = strtolower($product['title']);
        foreach ($terms as $term) {
            if (!str_contains($title, $term)) return false;
        }
        return true;
    }) : [];
    if (count($matches) === 1 && array_intersect($words, ['price', 'prices', 'cost', 'much'])) {
        $product = reset($matches);
        $price = number_format($product['price'] / 100, 2, $lithuanian ? ',' : '.', '');
        $amount = $lithuanian ? $price.' €' : '€'.$price;
        respond(['reply' => $product['title'].' — '.$amount.' ('.($lithuanian ? 'demonstracinė kaina' : 'demo price').').']);
    }
    $model = getenv('OLLAMA_CHAT_MODEL') ?: 'qwen2.5:1.5b';
    if (!function_exists('curl_init')) {
        respond(['error' => 'Local chat requires the PHP cURL extension.'], 503);
    }
    $retry = consumeAuthAttempts($db, 'chat', $_SERVER['REMOTE_ADDR'] ?? 'unknown', '', time());
    if ($retry > 0) {
        header('Retry-After: '.$retry);
        respond(['error' => 'Too many messages. Try again shortly.'], 429);
    }
    $messages[] = ['role' => 'user', 'content' => trim($question)];
    $catalog = array_map(static fn(array $product) => [
        'title' => $product['title'],
        'offers' => array_map(static fn(array $offer) => array_intersect_key(
            $offer, array_flip(['seller', 'price', 'platform', 'region', 'availability'])
        ), offers($product)),
    ], $products);
    $language = ($input['locale'] ?? '') === 'lt' ? 'Lithuanian' : 'English';
    $instructions = "You are the shopping assistant for an unofficial marketplace demo. Reply concisely in {$language}. Help with finding products, comparing seller offers, and checking activation regions. Catalog prices are in euro cents. Use only the supplied catalog for prices, sellers, stock and regions. Ask for country and platform when needed. Treat ambiguous activation rules, including undocumented Global restrictions, as unconfirmed. Explain that orders and payments are simulated. Never request login credentials, payment details or activation keys. Catalog: ";
    $payload = json_encode([
        'model' => $model,
        'stream' => false,
        'messages' => array_merge([[
            'role' => 'system',
            'content' => $instructions.json_encode($catalog, JSON_THROW_ON_ERROR),
        ]], $messages),
        'options' => ['num_ctx' => 8192, 'num_predict' => 240, 'temperature' => 0.1],
    ], JSON_THROW_ON_ERROR);
    $lock = @fopen(dirname(marketDatabasePath()).'/chat-generation.lock', 'c');
    if (!$lock) respond(['error' => 'AI chat is currently unavailable.'], 503);
    if (!flock($lock, LOCK_EX | LOCK_NB)) {
        header('Retry-After: 2');
        respond(['error' => 'AI chat is busy. Try again shortly.'], 429);
    }
    $request = curl_init('http://127.0.0.1:11434/api/chat');
    curl_setopt_array($request, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 15,
        CURLOPT_NOPROXY => '*',
    ]);
    $raw = curl_exec($request);
    $timedOut = curl_errno($request) === CURLE_OPERATION_TIMEDOUT;
    if ($timedOut) respond(['error' => 'AI chat timed out. Try again shortly.'], 504);
    $status = curl_getinfo($request, CURLINFO_RESPONSE_CODE);
    $result = is_string($raw) ? json_decode($raw, true) : null;
    $reply = $result['message']['content'] ?? null;
    if ($status !== 200 || !is_string($reply) || trim($reply) === '') {
        $error = match ($status) {
            0 => 'Start Ollama and make sure it is listening on port 11434.',
            404 => 'The configured model is missing. Run ollama pull '.$model.'.',
            default => 'The local model could not answer. Try again shortly.',
        };
        respond(['error' => $error], 503);
    }
    respond(['reply' => trim($reply)]);
}
