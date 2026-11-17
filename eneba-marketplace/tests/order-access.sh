#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
php_bin=${PHP_BIN:-php}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export MARKET_DB="$tmp/market.sqlite"
"$php_bin" server/setup.php >/dev/null
request() {
  "$php_bin" -d session.save_path="$tmp" -r '
    $_SERVER["REQUEST_URI"]="/api/orders";
    $_SERVER["REQUEST_METHOD"]="GET";
    if ($argv[1] !== "") session_id($argv[1]);
    register_shutdown_function(function () { echo "\n", http_response_code(); });
    require "server/router.php";
  ' "$1"
}
guest=$(request "")
printf '%s\n' "$guest" | grep -qx '401'
"$php_bin" -d session.save_path="$tmp" -r '
 $db=new PDO("sqlite:".getenv("MARKET_DB"));
 $write=$db->prepare("INSERT INTO users VALUES (?, ?, ?)");
 $order=$db->prepare("INSERT INTO orders VALUES (?,?,?,?)");
 foreach ([1,2] as $id) {
   $write->execute([$id,"demo$id@example.test","synthetic"]);
   $order->execute(["order-$id",$id,json_encode(["key"=>"DEMO-ONLY-$id"]),"2026-01-01"]);
   session_id("fixture-$id");
   session_start();
   $_SESSION["user"]=$id;
   session_write_close();
 }
'
for id in 1 2; do
  result=$(request "fixture-$id")
  expected=$(printf '{"orders":[{"key":"DEMO-ONLY-%s"}],"page":1,"hasMore":false}\n200' "$id")
  [ "$result" = "$expected" ]
done
printf '%s\n' 'PASS: guest denied and each fixture account sees only its own order and demo key'
