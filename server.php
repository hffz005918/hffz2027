<?php
// server.php - 完整的服务器端存储方案

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// 数据文件路径
$dataFile = __DIR__ . '/feedback_data.json';
$logFile = __DIR__ . '/server_debug.log';

// 确保日志目录可写
if (!file_exists($logFile)) {
    file_put_contents($logFile, '');
    chmod($logFile, 0666);
}

// 记录请求信息
function logMessage($message) {
    file_put_contents($GLOBALS['logFile'], date('Y-m-d H:i:s') . " - " . $message . "\n", FILE_APPEND);
}

// 自动权限检查和设置函数
function setupFilePermissions($filename) {
    $log = [];
    
    // 如果文件不存在，创建它
    if (!file_exists($filename)) {
        file_put_contents($filename, '[]');
        $log[] = "创建文件: $filename";
        chmod($filename, 0666);
    }
    
    // 检查是否可写
    if (!is_writable($filename)) {
        $log[] = "文件不可写，尝试修复权限...";
        
        // 尝试更改权限
        if (chmod($filename, 0666)) {
            $log[] = "✅ 权限修复成功";
        } else {
            $log[] = "❌ 权限修复失败";
        }
    } else {
        $log[] = "✅ 文件可写，权限正常";
    }
    
    // 记录调试信息
    if (file_exists($GLOBALS['logFile'])) {
        file_put_contents($GLOBALS['logFile'], date('Y-m-d H:i:s') . " - " . implode(" | ", $log) . "\n", FILE_APPEND);
    }
    
    return is_writable($filename);
}

// 在每次请求开始时自动检查权限
logMessage("=== 新的请求开始 ===");
logMessage("请求方法: " . $_SERVER['REQUEST_METHOD']);
logMessage("请求URI: " . ($_SERVER['REQUEST_URI'] ?? 'unknown'));

// 执行权限检查
$permissionOk = setupFilePermissions($dataFile);

if (!$permissionOk) {
    logMessage("⚠️ 警告: 文件权限可能有问题");
}

// 获取请求数据
$input = [];
$inputData = '';

try {
    // 支持 GET 和 POST 请求
    if ($_SERVER['REQUEST_METHOD'] == 'POST') {
        $inputData = file_get_contents('php://input');
        logMessage("原始输入数据: " . $inputData);
        
        if (!empty($inputData)) {
            $input = json_decode($inputData, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                logMessage("JSON 解析错误: " . json_last_error_msg());
                $input = [];
            }
        }
    } else if ($_SERVER['REQUEST_METHOD'] == 'GET') {
        // 对于GET请求，从查询参数获取action
        $input['action'] = $_GET['action'] ?? 'get_all';
        logMessage("GET请求动作: " . $input['action']);
    }
} catch (Exception $e) {
    logMessage("获取输入数据异常: " . $e->getMessage());
}

$action = $input['action'] ?? '';

logMessage("请求动作: " . $action);
logMessage("请求数据: " . json_encode($input));

// 数据操作函数
function getData() {
    global $dataFile;
    
    if (!file_exists($dataFile)) {
        return [];
    }
    
    $data = file_get_contents($dataFile);
    if ($data === false || trim($data) === '') {
        return [];
    }
    
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

try {
    switch ($action) {
        case 'get_all':
            $feedbacks = getData();
            echo json_encode([
                'success' => true,
                'data' => $feedbacks,
                'count' => count($feedbacks),
                'permission_status' => $permissionOk ? 'ok' : 'warning'
            ]);
            logMessage("GET_ALL请求完成，返回数据条数: " . count($feedbacks));
            break;
            
        case 'save_feedback':
            $feedback = $input['feedback'] ?? null;
            
            if (!$feedback) {
                echo json_encode([
                    'success' => false, 
                    'error' => '没有接收到反馈数据',
                    'debug_input' => $input
                ]);
                logMessage("错误: 没有接收到反馈数据");
                break;
            }
            
            logMessage("接收到反馈数据: " . json_encode($feedback));
            
            // 添加必要字段
            if (!isset($feedback['id'])) {
                $feedback['id'] = 'feedback_' . time() . '_' . uniqid();
            }
            if (!isset($feedback['timestamp'])) {
                $feedback['timestamp'] = date('c');
            }
            if (!isset($feedback['status'])) {
                $feedback['status'] = 'pending';
            }
            if (!isset($feedback['comments'])) {
                $feedback['comments'] = [];
            }
            if (!isset($feedback['likes'])) {
                $feedback['likes'] = 0;
            }
            if (!isset($feedback['likedBy'])) {
                $feedback['likedBy'] = [];
            }
            
            logMessage("处理反馈数据，ID: " . $feedback['id']);
            
            $feedbacks = getData();
            logMessage("当前已有数据条数: " . count($feedbacks));
            
            $feedbacks[] = $feedback;
            
            logMessage("准备保存数据，总条数: " . count($feedbacks));
            
            $saved = saveData($feedbacks);
            
            if ($saved) {
                echo json_encode([
                    'success' => true,
                    'id' => $feedback['id'],
                    'message' => '保存成功',
                    'debug' => [
                        'total_feedbacks' => count($feedbacks),
                        'file_path' => $dataFile,
                        'file_exists' => file_exists($dataFile),
                        'file_writable' => is_writable($dataFile)
                    ]
                ]);
                logMessage("✅ 反馈保存成功，ID: " . $feedback['id']);
                
                // 验证数据确实保存了
                $verifyData = getData();
                logMessage("验证保存: 文件现在包含 " . count($verifyData) . " 条数据");
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => '保存到文件失败，请检查文件权限',
                    'debug' => [
                        'file_path' => $dataFile,
                        'file_exists' => file_exists($dataFile),
                        'file_writable' => is_writable($dataFile),
                        'last_error' => error_get_last()
                    ]
                ]);
                logMessage("❌ 反馈保存失败");
            }
            break;
            
        // ... 其他操作保持不变 ...
            
        default:
            // 默认返回所有数据
            $feedbacks = getData();
            echo json_encode([
                'success' => true,
                'data' => $feedbacks,
                'count' => count($feedbacks),
                'permission_status' => $permissionOk ? 'ok' : 'warning'
            ]);
            logMessage("默认请求完成，返回数据条数: " . count($feedbacks));
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false, 
        'error' => '服务器异常: ' . $e->getMessage()
    ]);
    logMessage("异常: " . $e->getMessage());
}

logMessage("=== 请求处理完成 ===\n");
?>