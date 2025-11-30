<?php
// diagnose.php - 诊断服务器问题
echo "<h1>服务器诊断信息</h1>";

// 1. 检查 PHP 是否工作
echo "<h2>1. PHP 基本信息</h2>";
echo "PHP 版本: " . PHP_VERSION . "<br>";
echo "服务器软件: " . ($_SERVER['SERVER_SOFTWARE'] ?? '未知') . "<br>";
echo "当前时间: " . date('Y-m-d H:i:s') . "<br>";

// 2. 检查文件权限
echo "<h2>2. 文件权限检查</h2>";
$files = ['server-get.php', 'feedback_data.json', 'diagnose.php'];
foreach ($files as $file) {
    $exists = file_exists($file);
    $writable = is_writable($file);
    $size = $exists ? filesize($file) : 0;
    echo "{$file}: 存在=" . ($exists ? '是' : '否') . ", 可写=" . ($writable ? '是' : '否') . ", 大小={$size}字节<br>";
}

// 3. 检查 JSON 扩展
echo "<h2>3. PHP 扩展检查</h2>";
echo "JSON 扩展: " . (extension_loaded('json') ? '已加载' : '未加载') . "<br>";

// 4. 测试 JSON 输出
echo "<h2>4. JSON 输出测试</h2>";
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => '诊断完成',
    'timestamp' => date('c')
]);
?>