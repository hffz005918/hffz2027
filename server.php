<?php
// 设置响应头
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// 数据文件路径
$dataFile = __DIR__ . '/feedback_data.json';
$logFile = __DIR__ . '/server_debug.log';

// 自动权限检查和设置函数
function setupFilePermissions($filename) {
    $log = [];
    
    // 如果文件不存在，创建它
    if (!file_exists($filename)) {
        file_put_contents($filename, '[]');
        $log[] = "创建文件: $filename";
    }
    
    // 获取当前权限
    $currentPerms = fileperms($filename);
    $currentPermsOct = substr(sprintf('%o', $currentPerms), -4);
    
    $log[] = "文件: $filename 当前权限: $currentPermsOct";
    
    // 检查是否可写
    if (!is_writable($filename)) {
        $log[] = "文件不可写，尝试修复权限...";
        
        // 尝试更改权限为 666 (所有用户可读写)
        if (chmod($filename, 0666)) {
            $newPerms = substr(sprintf('%o', fileperms($filename)), -4);
            $log[] = "✅ 权限修复成功: $currentPermsOct -> $newPerms";
        } else {
            $log[] = "❌ 权限修复失败";
            
            // 尝试其他权限方案
            if (chmod($filename, 0644)) {
                $newPerms = substr(sprintf('%o', fileperms($filename)), -4);
                $log[] = "✅ 使用644权限成功: $newPerms";
            } else {
                $log[] = "❌ 所有权限设置尝试都失败";
            }
        }
    } else {
        $log[] = "✅ 文件可写，权限正常";
    }
    
    // 记录调试信息
    file_put_contents($GLOBALS['logFile'], date('Y-m-d H:i:s') . " - " . implode(" | ", $log) . "\n", FILE_APPEND);
    
    return is_writable($filename);
}

// 记录请求信息
function logMessage($message) {
    file_put_contents($GLOBALS['logFile'], date('Y-m-d H:i:s') . " - " . $message . "\n", FILE_APPEND);
}

// 在每次请求开始时自动检查权限
logMessage("=== 新的请求开始 ===");
logMessage("请求方法: " . $_SERVER['REQUEST_METHOD']);
logMessage("请求URI: " . $_SERVER['REQUEST_URI']);

// 执行权限检查
$permissionOk = setupFilePermissions($dataFile);

if (!$permissionOk) {
    logMessage("⚠️ 警告: 文件权限可能有问题");
}

// 数据操作函数
function getData() {
    global $dataFile;
    
    if (!file_exists($dataFile)) {
        return [];
    }
    
    $data = file_get_contents($dataFile);
    $decoded = json_decode($data, true);
    
    return $decoded ?: [];
}

function saveData($data) {
    global $dataFile;
    
    // 保存前再次检查权限
    if (!is_writable($dataFile)) {
        logMessage("❌ 保存失败: 文件不可写");
        return false;
    }
    
    $result = file_put_contents($dataFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    if ($result === false) {
        logMessage("❌ 文件写入失败");
        return false;
    }
    
    logMessage("✅ 数据保存成功，条数: " . count($data));
    return true;
}

// 处理请求
$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

logMessage("请求数据: " . json_encode($input));

switch ($method) {
    case 'GET':
        $feedbacks = getData();
        echo json_encode([
            'success' => true,
            'data' => $feedbacks,
            'count' => count($feedbacks),
            'permission_status' => $permissionOk ? 'ok' : 'warning'
        ]);
        logMessage("GET请求完成，返回数据条数: " . count($feedbacks));
        break;
        
    case 'POST':
        $feedback = $input;
        
        if (!$feedback) {
            echo json_encode([
                'success' => false, 
                'error' => '没有接收到数据',
                'permission_status' => $permissionOk ? 'ok' : 'warning'
            ]);
            logMessage("错误: 没有接收到数据");
            break;
        }
        
        // 添加必要字段
        if (!isset($feedback['id'])) {
            $feedback['id'] = uniqid() . '_' . time();
        }
        if (!isset($feedback['timestamp'])) {
            $feedback['timestamp'] = date('c');
        }
        if (!isset($feedback['status'])) {
            $feedback['status'] = 'pending';
        }
        
        logMessage("处理反馈数据，ID: " . $feedback['id']);
        
        $feedbacks = getData();
        $feedbacks[] = $feedback;
        
        $saved = saveData($feedbacks);
        
        if ($saved) {
            echo json_encode([
                'success' => true,
                'id' => $feedback['id'],
                'message' => '保存成功',
                'permission_status' => 'ok'
            ]);
            logMessage("✅ 反馈保存成功，ID: " . $feedback['id']);
        } else {
            echo json_encode([
                'success' => false,
                'error' => '保存到文件失败，请检查文件权限',
                'permission_status' => 'error'
            ]);
            logMessage("❌ 反馈保存失败");
        }
        break;
        
    default:
        echo json_encode([
            'success' => false, 
            'error' => '不支持的请求方法: ' . $method,
            'permission_status' => $permissionOk ? 'ok' : 'warning'
        ]);
        logMessage("错误: 不支持的请求方法: " . $method);
}

logMessage("=== 请求处理完成 ===\n");
?>