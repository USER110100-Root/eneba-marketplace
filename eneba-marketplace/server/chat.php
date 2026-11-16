<?php
declare(strict_types=1);

function marketplaceChat(array $input, array $products, PDO $db): never {
    $question = $input['message'] ?? null;
    if (!is_string($question) || trim($question) === '' || strlen($question) > 1200) {
        respond(['error' => 'Enter a message of up to 1200 bytes.'], 400);
    }
    $lithuanian = ($input['locale'] ?? '') === 'lt';
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
    $history = $input['history'] ?? [];
    $messages = [];
    foreach (is_array($history) ? array_slice($history, -6) : [] as $message) {
        if (is_array($message) && in_array($message['role'] ?? null, ['user', 'assistant'], true)
            && is_string($message['content'] ?? null) && strlen($message['content']) <= 2400) {
            $messages[] = ['role' => $message['role'], 'content' => $message['content']];
        }
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
    session_write_close();
    $request = curl_init('http://127.0.0.1:11434/api/chat');
    curl_setopt_array($request, [
        CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 2, CURLOPT_TIMEOUT => 75,
        CURLOPT_NOPROXY => '*',
    ]);
    $raw = curl_exec($request);
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
