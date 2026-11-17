<?php
declare(strict_types=1);
function catalogSeed(): array {
    $keys = ['id', 'title', 'platform', 'region', 'price', 'old', 'badge', 'cashback', 'category', 'group', 'art'];
    return array_map(function ($row) use ($keys) {
        $row[10] = $row[10] ? '/assets/' . $row[10] . '.png' : '';
        return array_combine($keys, $row);
    }, json_decode(file_get_contents(__DIR__.'/seed.json'), true, 512, JSON_THROW_ON_ERROR));
}
function homepage(array $products, string $locale): array {
    $data = json_decode(file_get_contents(__DIR__.'/home.json'), true, 512, JSON_THROW_ON_ERROR);
    $shelves = array_map(function ($shelf) use ($products, $locale) {
        $id = $shelf['id'];
        $shelf['title'] = $shelf['title'][$locale];
        $shelf['products'] = collectionProducts($products, $id);
        $shelf['destination'] = $id === 'egift-cards' ? '#/store?category=eGift+Cards' : '#/store?collection='.$id;
        return $shelf;
    }, $data['shelves']);
    usort($shelves, fn($a,$b)=>$a['order'] <=> $b['order']);
    $slides = array_map(function ($slide) use ($locale) {
        foreach (['eyebrow','supporting','cta'] as $key) $slide[$key] = $slide[$key][$locale];
        return $slide;
    }, $data['slides']);
    return ['slides'=>$slides,'shelves'=>$shelves,'categories'=>json_decode(file_get_contents(__DIR__.'/categories.json'),true,512,JSON_THROW_ON_ERROR)];
}
function collectionProducts(array $products, string $id): array {
    if ($id === 'featured-deals') {
        $featured = ['gta','psn','steam','cyberpunk','resident','hogwarts'];
        $byId = array_column($products, null, 'id');
        return array_values(array_filter(array_map(fn($id)=>$byId[$id] ?? null,$featured)));
    }
    $groups = ['top-games'=>'Top games','egift-cards'=>'Best selling eGift Cards','gift-cards'=>'Best selling gift cards','upcoming'=>'Upcoming games'];
    return array_values(array_filter($products, fn($p)=>$p['group'] === ($groups[$id] ?? null)));
}
function productDetails(): array {
    return json_decode(file_get_contents(__DIR__.'/details.json'), true, 512, JSON_THROW_ON_ERROR);
}
function offers(array $product): array {
    $sellers = [['GameVault',4.9,2816],['Digital Arc',4.8,1453],['Key District',4.7,864]];
    return array_map(function ($seller, $i) use ($product) {
        $price = $product['price'] + $i * 149;
        $old = $product['old'] > $price ? $product['old'] : 0;
        return ['id'=>$i+1,'sellerId'=>$i+1,'seller'=>$seller[0],'rating'=>$seller[1],
            'reviews'=>$seller[2],'price'=>$price,'old'=>$old,
            'discount'=>$old ? round((1-$price/$old)*100) : 0,
            'cashback'=>$product['cashback'],'platform'=>$product['platform'],
            'region'=>$product['id']==='batman-arkham-collection' && $i===1 ? 'Europe' : $product['region'],
            'edition'=>str_contains($product['title'],'Collection') ? 'Collection' : 'Standard',
            'availability'=>'In stock'];
    }, $sellers, array_keys($sellers));
}
