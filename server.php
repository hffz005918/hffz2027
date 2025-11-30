<?php
// server.php - 完整的员工反馈系统服务器端
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// 数据文件路径
$dataFile = __DIR__ . '/feedback_data.json';
$logFile = __DIR__ . '/server_debug.log';

// 设置错误报告
error_reporting(E_ALL);
ini_set('display_errors', 0); // 生产环境设置为 0

// 记录请求信息
function logMessage($message) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "{$timestamp} - {$message}\n";
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// 自动权限检查和设置函数
function setupFilePermissions($filename) {
    $log = [];
    
    // 如果文件不存在，创建它
    if (!file_exists($filename)) {
        if (file_put_contents($filename, '[]') !== false) {
            $log[] = "创建文件: {$filename}";
            chmod($filename, 0666);
        } else {
            $log[] = "❌ 文件创建失败: {$filename}";
            return false;
        }
    }
    
    // 检查是否可写
    if (!is_writable($filename)) {
        $log[] = "文件不可写，尝试修复权限...";
        
        // 尝试更改权限
        if (chmod($filename, 0666)) {
            $log[] = "✅ 权限修复成功";
        } else {
            $log[] = "❌ 权限修复失败";
            return false;
        }
    } else {
        $log[] = "✅ 文件可写，权限正常";
    }
    
    // 记录调试信息
    foreach ($log as $logMessage) {
        logMessage($logMessage);
    }
    
    return true;
}

// 在每次请求开始时自动检查权限
logMessage("=== 新的请求开始 ===");
logMessage("请求方法: " . $_SERVER['REQUEST_METHOD']);
logMessage("请求URI: " . ($_SERVER['REQUEST_URI'] ?? 'unknown'));

// 执行权限检查
$dataFilePermissionOk = setupFilePermissions($dataFile);
$logFilePermissionOk = setupFilePermissions($logFile);

if (!$dataFilePermissionOk) {
    logMessage("⚠️ 警告: 数据文件权限可能有问题");
}

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
    if (json_last_error() !== JSON_ERROR_NONE) {
        logMessage("JSON 解析错误: " . json_last_error_msg());
        return [];
    }
    
    return is_array($decoded) ? $decoded : [];
}

function saveData($data) {
    global $dataFile;
    
    // 保存前再次检查权限
    if (!is_writable($dataFile)) {
        logMessage("❌ 保存失败: 文件不可写");
        return false;
    }
    
    $jsonData = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($jsonData === false) {
        logMessage("❌ JSON 编码失败");
        return false;
    }
    
    $result = file_put_contents($dataFile, $jsonData, LOCK_EX);
    
    if ($result === false) {
        logMessage("❌ 文件写入失败");
        return false;
    }
    
    logMessage("✅ 数据保存成功，条数: " . count($data));
    return true;
}

// 获取请求数据
$input = [];
$action = '';

try {
    if ($_SERVER['REQUEST_METHOD'] == 'POST') {
        $inputData = file_get_contents('php://input');
        logMessage("原始输入数据长度: " . strlen($inputData));
        
        if (!empty($inputData)) {
            $input = json_decode($inputData, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $errorMsg = "JSON 解析错误: " . json_last_error_msg();
                logMessage($errorMsg);
                throw new Exception($errorMsg);
            }
        }
        $action = $input['action'] ?? '';
    } else if ($_SERVER['REQUEST_METHOD'] == 'GET') {
        // 对于GET请求，从查询参数获取action
        $action = $_GET['action'] ?? 'get_all';
        $input['action'] = $action;
        
        // 对于GET请求的保存操作，从参数获取数据
        if ($action === 'save_feedback' && isset($_GET['data'])) {
            $input['feedback'] = json_decode($_GET['data'], true);
        }
    }
} catch (Exception $e) {
    logMessage("获取输入数据异常: " . $e->getMessage());
    echo json_encode([
        'success' => false, 
        'error' => '数据解析失败: ' . $e->getMessage()
    ]);
    exit;
}

logMessage("请求动作: " . $action);
logMessage("请求数据: " . json_encode($input, JSON_UNESCAPED_UNICODE));

try {
    switch ($action) {
        case 'get_all':
            $feedbacks = getData();
            echo json_encode([
                'success' => true,
                'data' => $feedbacks,
                'count' => count($feedbacks),
                'permission_status' => $dataFilePermissionOk ? 'ok' : 'warning',
                'timestamp' => date('c')
            ], JSON_UNESCAPED_UNICODE);
            logMessage("GET_ALL请求完成，返回数据条数: " . count($feedbacks));
            break;
            
        case 'save_feedback':
            $feedback = $input['feedback'] ?? null;
            
            if (!$feedback || !is_array($feedback)) {
                $errorResponse = [
                    'success' => false, 
                    'error' => '没有接收到有效的反馈数据',
                    'debug' => [
                        'received_feedback' => $feedback,
                        'input_keys' => array_keys($input)
                    ]
                ];
                echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
                logMessage("错误: 没有接收到有效的反馈数据");
                break;
            }
            
            logMessage("接收到反馈数据，类型: " . ($feedback['type'] ?? 'unknown'));
            
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
                $successResponse = [
                    'success' => true,
                    'id' => $feedback['id'],
                    'message' => '反馈提交成功',
                    'debug' => [
                        'total_feedbacks' => count($feedbacks),
                        'file_path' => $dataFile,
                        'file_exists' => file_exists($dataFile),
                        'file_writable' => is_writable($dataFile),
                        'file_size' => file_exists($dataFile) ? filesize($dataFile) : 0
                    ]
                ];
                echo json_encode($successResponse, JSON_UNESCAPED_UNICODE);
                logMessage("✅ 反馈保存成功，ID: " . $feedback['id']);
                
                // 验证数据确实保存了
                $verifyData = getData();
                logMessage("验证保存: 文件现在包含 " . count($verifyData) . " 条数据");
            } else {
                $errorResponse = [
                    'success' => false,
                    'error' => '保存到文件失败，请检查文件权限',
                    'debug' => [
                        'file_path' => $dataFile,
                        'file_exists' => file_exists($dataFile),
                        'file_writable' => is_writable($dataFile),
                        'last_error' => error_get_last()
                    ]
                ];
                echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
                logMessage("❌ 反馈保存失败");
            }
            break;
            
        case 'add_comment':
            $feedbackId = $input['feedbackId'] ?? '';
            $comment = $input['comment'] ?? null;
            
            if (!$feedbackId || !$comment || !is_array($comment)) {
                echo json_encode([
                    'success' => false, 
                    'error' => '缺少必要参数或参数格式错误'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            $feedbacks = getData();
            $found = false;
            
            foreach ($feedbacks as &$feedback) {
                if ($feedback['id'] === $feedbackId) {
                    if (!isset($feedback['comments'])) {
                        $feedback['comments'] = [];
                    }
                    
                    $comment['id'] = 'comment_' . uniqid();
                    $comment['timestamp'] = date('c');
                    
                    $feedback['comments'][] = $comment;
                    $found = true;
                    break;
                }
            }
            
            if ($found) {
                $saved = saveData($feedbacks);
                if ($saved) {
                    echo json_encode([
                        'success' => true,
                        'commentId' => $comment['id'],
                        'message' => '评论添加成功'
                    ], JSON_UNESCAPED_UNICODE);
                    logMessage("✅ 评论添加成功，反馈ID: " . $feedbackId);
                } else {
                    echo json_encode([
                        'success' => false,
                        'error' => '保存失败'
                    ], JSON_UNESCAPED_UNICODE);
                }
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => '反馈不存在'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'update_status':
            $feedbackId = $input['feedbackId'] ?? '';
            $status = $input['status'] ?? '';
            
            if (!$feedbackId || !$status) {
                echo json_encode([
                    'success' => false, 
                    'error' => '缺少必要参数'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            $feedbacks = getData();
            $found = false;
            
            foreach ($feedbacks as &$feedback) {
                if ($feedback['id'] === $feedbackId) {
                    $feedback['status'] = $status;
                    $found = true;
                    logMessage("更新反馈状态: {$feedbackId} -> {$status}");
                    break;
                }
            }
            
            if ($found) {
                $saved = saveData($feedbacks);
                if ($saved) {
                    echo json_encode([
                        'success' => true,
                        'message' => '状态更新成功'
                    ], JSON_UNESCAPED_UNICODE);
                    logMessage("✅ 状态更新成功，反馈ID: " . $feedbackId . " -> " . $status);
                } else {
                    echo json_encode([
                        'success' => false,
                        'error' => '保存失败'
                    ], JSON_UNESCAPED_UNICODE);
                }
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => '反馈不存在'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'delete_feedback':
            $feedbackId = $input['feedbackId'] ?? '';
            
            if (!$feedbackId) {
                echo json_encode([
                    'success' => false, 
                    'error' => '缺少反馈ID'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            $feedbacks = getData();
            $newFeedbacks = array_filter($feedbacks, function($feedback) use ($feedbackId) {
                return $feedback['id'] !== $feedbackId;
            });
            
            if (count($newFeedbacks) < count($feedbacks)) {
                $saved = saveData(array_values($newFeedbacks));
                if ($saved) {
                    echo json_encode([
                        'success' => true,
                        'message' => '删除成功',
                        'deleted_id' => $feedbackId
                    ], JSON_UNESCAPED_UNICODE);
                    logMessage("✅ 删除成功，反馈ID: " . $feedbackId);
                } else {
                    echo json_encode([
                        'success' => false,
                        'error' => '保存失败'
                    ], JSON_UNESCAPED_UNICODE);
                }
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => '反馈不存在'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'like_feedback':
            $feedbackId = $input['feedbackId'] ?? '';
            $userId = $input['userId'] ?? '';
            
            if (!$feedbackId) {
                echo json_encode([
                    'success' => false, 
                    'error' => '缺少反馈ID'
                ], JSON_UNESCAPED_UNICODE);
                break;
            }
            
            $feedbacks = getData();
            $found = false;
            
            foreach ($feedbacks as &$feedback) {
                if ($feedback['id'] === $feedbackId) {
                    if (!isset($feedback['likes'])) {
                        $feedback['likes'] = 0;
                    }
                    if (!isset($feedback['likedBy'])) {
                        $feedback['likedBy'] = [];
                    }
                    
                    // 检查用户是否已经点赞
                    if ($userId && !in_array($userId, $feedback['likedBy'])) {
                        $feedback['likes']++;
                        $feedback['likedBy'][] = $userId;
                        logMessage("用户 {$userId} 点赞反馈 {$feedbackId}");
                    } elseif (!$userId) {
                        // 如果没有用户ID，直接增加点赞数
                        $feedback['likes']++;
                        logMessage("匿名点赞反馈 {$feedbackId}");
                    }
                    
                    $found = true;
                    break;
                }
            }
            
            if ($found) {
                $saved = saveData($feedbacks);
                if ($saved) {
                    echo json_encode([
                        'success' => true,
                        'message' => '点赞成功',
                        'likes' => $feedbacks[array_search($feedbackId, array_column($feedbacks, 'id'))]['likes'] ?? 0
                    ], JSON_UNESCAPED_UNICODE);
                    logMessage("✅ 点赞成功，反馈ID: " . $feedbackId);
                } else {
                    echo json_encode([
                        'success' => false,
                        'error' => '保存失败'
                    ], JSON_UNESCAPED_UNICODE);
                }
            } else {
                echo json_encode([
                    'success' => false,
                    'error' => '反馈不存在'
                ], JSON_UNESCAPED_UNICODE);
            }
            break;
            
        case 'test_connection':
            // 测试连接接口
            echo json_encode([
                'success' => true,
                'message' => '服务器连接正常',
                'server_time' => date('c'),
                'php_version' => PHP_VERSION,
                'file_permissions' => [
                    'data_file' => [
                        'exists' => file_exists($dataFile),
                        'writable' => is_writable($dataFile),
                        'size' => file_exists($dataFile) ? filesize($dataFile) : 0
                    ],
                    'log_file' => [
                        'exists' => file_exists($logFile),
                        'writable' => is_writable($logFile),
                        'size' => file_exists($logFile) ? filesize($logFile) : 0
                    ]
                ]
            ], JSON_UNESCAPED_UNICODE);
            logMessage("测试连接请求");
            break;
            
        default:
            // 默认返回所有数据
            $feedbacks = getData();
            echo json_encode([
                'success' => true,
                'data' => $feedbacks,
                'count' => count($feedbacks),
                'permission_status' => $dataFilePermissionOk ? 'ok' : 'warning',
                'server_info' => [
                    'version' => '1.0',
                    'timestamp' => date('c')
                ]
            ], JSON_UNESCAPED_UNICODE);
            logMessage("默认请求完成，返回数据条数: " . count($feedbacks));
    }
} catch (Exception $e) {
    $errorResponse = [
        'success' => false, 
        'error' => '服务器异常: ' . $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ];
    echo json_encode($errorResponse, JSON_UNESCAPED_UNICODE);
    logMessage("异常: " . $e->getMessage());
    logMessage("堆栈跟踪: " . $e->getTraceAsString());
}

logMessage("=== 请求处理完成 ===\n");
?>