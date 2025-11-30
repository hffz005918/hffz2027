<?php
// server-get.php - 纯GET版本的服务器
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// 数据文件路径
$dataFile = __DIR__ . '/feedback_data.json';
$logFile = __DIR__ . '/server_debug.log';

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 0);

// 记录日志
function logMessage($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "{$timestamp} - {$message}\n";
    @file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// 确保文件存在
function ensureFile($filename) {
    if (!file_exists($filename)) {
        file_put_contents($filename, '[]');
        chmod($filename, 0666);
    }
    return is_writable($filename);
}

// 获取数据
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
    return is_array($decoded) ? $decoded : [];
}

// 保存数据
function saveData($data) {
    global $dataFile;
    
    $jsonData = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($dataFile, $jsonData) !== false;
}

// 初始化文件
ensureFile($dataFile);
ensureFile($logFile);

logMessage("GET请求: " . $_SERVER['REQUEST_URI']);

// 获取动作参数
$action = $_GET['action'] ?? 'get_all';

try {
    switch ($action) {
        case 'get_all':
            $feedbacks = getData();
            echo json_encode([
                'success' => true,
                'data' => $feedbacks,
                'count' => count($feedbacks)
            ], JSON_UNESCAPED_UNICODE);
            break;
            
        case 'save_feedback':
            $data = $_GET['data'] ?? '';
            if (empty($data)) {
                echo json_encode(['success' => false, 'error' => '没有数据']);
                break;
            }
            
            $feedback = json_decode(urldecode($data), true);
            if (!$feedback) {
                echo json_encode(['success' => false, 'error' => '数据格式错误']);
                break;
            }
            
            // 添加必要字段
            $feedback['id'] = 'feedback_' . time() . '_' . uniqid();
            $feedback['timestamp'] = date('c');
            $feedback['status'] = 'pending';
            $feedback['comments'] = [];
            $feedback['likes'] = 0;
            
            $feedbacks = getData();
            $feedbacks[] = $feedback;
            
            if (saveData($feedbacks)) {
                echo json_encode([
                    'success' => true,
                    'id' => $feedback['id'],
                    'message' => '保存成功'
                ], JSON_UNESCAPED_UNICODE);
                logMessage("保存成功: " . $feedback['id']);
            } else {
                echo json_encode(['success' => false, 'error' => '保存失败']);
            }
            break;
            
        case 'update_status':
            $feedbackId = $_GET['id'] ?? '';
            $status = $_GET['status'] ?? '';
            
            if (!$feedbackId || !$status) {
                echo json_encode(['success' => false, 'error' => '参数缺失']);
                break;
            }
            
            $feedbacks = getData();
            $updated = false;
            
            foreach ($feedbacks as &$fb) {
                if ($fb['id'] === $feedbackId) {
                    $fb['status'] = $status;
                    $updated = true;
                    break;
                }
            }
            
            if ($updated && saveData($feedbacks)) {
                echo json_encode(['success' => true, 'message' => '更新成功']);
            } else {
                echo json_encode(['success' => false, 'error' => '更新失败']);
            }
            break;
            
        case 'delete_feedback':
            $feedbackId = $_GET['id'] ?? '';
            
            if (!$feedbackId) {
                echo json_encode(['success' => false, 'error' => '参数缺失']);
                break;
            }
            
            $feedbacks = getData();
            $newFeedbacks = array_filter($feedbacks, function($fb) use ($feedbackId) {
                return $fb['id'] !== $feedbackId;
            });
            
            if (count($newFeedbacks) < count($feedbacks) && saveData(array_values($newFeedbacks))) {
                echo json_encode(['success' => true, 'message' => '删除成功']);
            } else {
                echo json_encode(['success' => false, 'error' => '删除失败']);
            }
            break;
            
        case 'test':
            echo json_encode([
                'success' => true,
                'message' => '服务器正常工作',
                'method' => 'GET',
                'timestamp' => date('c')
            ]);
            break;
            
        default:
            $feedbacks = getData();
            echo json_encode([
                'success' => true,
                'data' => $feedbacks,
                'count' => count($feedbacks)
            ], JSON_UNESCAPED_UNICODE);
    }
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => '服务器错误: ' . $e->getMessage()
    ]);
}

logMessage("请求完成: " . $action);
?>