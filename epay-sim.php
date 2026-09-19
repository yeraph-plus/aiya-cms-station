<?php
require_once '/var/www/html/wp-load.php';
$u = wp_create_user('probeaf3', 'ProbePass123456', 'probe-af3@example.com');
$order = json_decode(file_get_contents('epay-order.json'), true);
$query = [];
parse_str(parse_url($order['data']['submitUrl'], PHP_URL_QUERY), $query);
$key = get_option('aiya_core_sponsorship_payments')['epay_key'];
$notify = [
    'pid' => $query['pid'],
    'out_trade_no' => $query['out_trade_no'],
    'money' => '5.99',
    'param' => $query['param'],
    'trade_status' => 'TRADE_SUCCESS',
];
$pairs = [];
$sorted = $notify;
ksort($sorted);
foreach ($sorted as $k => $v) {
    $v = (string) $v;
    if ($v === '' || $v === '0') { continue; }
    $pairs[] = $k . '=' . $v;
}
$notify['sign'] = md5(implode('&', $pairs) . $key);
$notify['sign_type'] = 'MD5';
echo "UID=$u" . PHP_EOL;
echo "NOTIFY=" . http_build_query($notify) . PHP_EOL;
