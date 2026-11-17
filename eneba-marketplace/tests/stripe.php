<?php
require __DIR__.'/../server/payments.php';
function check(bool $ok): void { if (!$ok) throw new RuntimeException('Assertion failed'); }
$db=new PDO('sqlite::memory:');
$db->exec('CREATE TABLE checkout_attempts(id TEXT PRIMARY KEY,user_id INTEGER,total INTEGER,payload TEXT,status TEXT,session_id TEXT,url TEXT); CREATE TABLE orders(id TEXT PRIMARY KEY,user_id INTEGER,payload TEXT,created TEXT)');
$order=['id'=>'order1','created'=>gmdate('c'),'total'=>1234,'items'=>[['title'=>'Test']]];
$db->prepare('INSERT INTO checkout_attempts VALUES (?,?,?,?,?,?,?)')->execute(['order1',1,1234,json_encode($order),'pending','cs_test_1',null]);
$event=['livemode'=>false,'type'=>'checkout.session.completed','data'=>['object'=>['id'=>'cs_test_1','payment_status'=>'unpaid','currency'=>'eur','amount_total'=>1234,'metadata'=>['order_id'=>'order1']]]];
fulfillStripe($db,$event); check((int)$db->query('SELECT count(*) FROM orders')->fetchColumn()===0);
$event['data']['object']['payment_status']='paid';
$bad=$event;$bad['data']['object']['amount_total']=1;
try {fulfillStripe($db,$bad);throw new LogicException('Mismatch accepted');}catch(RuntimeException $e){}
fulfillStripe($db,$event);
$first=$db->query('SELECT payload FROM orders')->fetchColumn();
fulfillStripe($db,$event);
check($first===$db->query('SELECT payload FROM orders')->fetchColumn());
check((int)$db->query('SELECT count(*) FROM orders')->fetchColumn()===1);
$raw=json_encode($event);$time=time();$sig=hash_hmac('sha256',$time.'.'.$raw,'whsec_test');
check(verifiedStripeEvent($raw,"t=$time,v1=$sig",'whsec_test')===$event);
foreach ([$raw.' ',str_replace('false','true',$raw)] as $invalid) {
    $rejected=false;try{verifiedStripeEvent($invalid,"t=$time,v1=$sig",'whsec_test');}catch(Throwable){$rejected=true;}check($rejected);
}
echo "PASS: unpaid blocked, amount mismatch blocked, repeated delivery stable, signatures checked\n";
