<?php
// server-get.php - 员工反馈系统服务器
// 强制设置响应头为首行
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// 关闭错误显示，避免污染JSON输出
ini_set('display_errors', 0);
error_reporting(0);

// 数据文件路径
$dataFile = __DIR__ . '/feedback_data.json';

// 简单的响应函数
function sendResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// 确保数据文件存在
function ensureDataFile() {
    global $dataFile;
    
    if (!file_exists($dataFile)) {
        file_put_contents($dataFile, '[]');
    }
    
    return file_exists($dataFile);
}

// 读取数据
function readData() {
    global $dataFile;
    
    if (!file_exists($dataFile)) {
        return [];
    }
    
    $content = file_get_contents($dataFile);
    if ($content === false || trim($content) === '') {
        return [];
    }
    
    $data = json_decode($content, true);
    return is_array($data) ? $data : [];
}

// 保存数据
function saveData($data) {
    global $dataFile;
    
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($dataFile, $json) !== false;
}

// 主程序开始
try {
    // 确保数据文件存在
    if (!ensureDataFile()) {
        sendResponse([
            'success' => false,
            'error' => '无法创建数据文件'
        ]);
    }
    
    // 获取动作参数
    $action = $_GET['action'] ?? 'get_all';
    
    switch ($action) {
        case 'get_all':
            $data = readData();
            sendResponse([
                'success' => true,
                'data' => $data,
                'count' => count($data)
            ]);
            break;
            
        case 'save_feedback':
            $feedbackData = $_GET['data'] ?? '';
            
            if (empty($feedbackData)) {
                sendResponse([
                    'success' => false,
                    'error' => '没有接收到数据'
                ]);
            }
            
            // URL解码并解析JSON
            $decodedData = urldecode($feedbackData);
            $feedback = json_decode($decodedData, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendResponse([
                    'success' => false,
                    'error' => '数据格式错误: ' . json_last_error_msg()
                ]);
            }
            
            // 验证必要字段
            if (empty($feedback['content'])) {
                sendResponse([
                    'success' => false,
                    'error' => '反馈内容不能为空'
                ]);
            }
            
            // 添加系统字段
            $feedback['id'] = 'fb_' . time() . '_' . mt_rand(1000, 9999);
            $feedback['timestamp'] = date('c');
            $feedback['status'] = 'pending';
            $feedback['likes'] = 0;
            
            // 读取现有数据并添加新反馈
            $allData = readData();
            $allData[] = $feedback;
            
            if (saveData($allData)) {
                sendResponse([
                    'success' => true,
                    'id' => $feedback['id'],
                    'message' => '反馈保存成功',
                    'count' => count($allData)
                ]);
            } else {
                sendResponse([
                    'success' => false,
                    'error' => '保存失败'
                ]);
            }
            break;
            
        case 'update_status':
            $id = $_GET['id'] ?? '';
            $status = $_GET['status'] ?? '';
            
            if (empty($id) || empty($status)) {
                sendResponse([
                    'success' => false,
                    'error' => '缺少必要参数'
                ]);
            }
            
            $allData = readData();
            $found = false;
            
            foreach ($allData as &$item) {
                if ($item['id'] === $id) {
                    $item['status'] = $status;
                    $found = true;
                    break;
                }
            }
            
            if ($found && saveData($allData)) {
                sendResponse([
                    'success' => true,
                    'message' => '状态更新成功'
                ]);
            } else {
                sendResponse([
                    'success' => false,
                    'error' => '更新失败'
                ]);
            }
            break;
            
        case 'delete_feedback':
            $id = $_GET['id'] ?? '';
            
            if (empty($id)) {
                sendResponse([
                    'success' => false,
                    'error' => '缺少反馈ID'
                ]);
            }
            
            $allData = readData();
            $newData = array_filter($allData, function($item) use ($id) {
                return $item['id'] !== $id;
            });
            
            if (count($newData) < count($allData) && saveData(array_values($newData))) {
                sendResponse([
                    'success' => true,
                    'message' => '删除成功'
                ]);
            } else {
                sendResponse([
                    'success' => false,
                    'error' => '删除失败'
                ]);
            }
            break;
            
        case 'test':
            sendResponse([
                'success' => true,
                'message' => '服务器连接正常',
                'timestamp' => date('c'),
                'data_file' => [
                    'exists' => file_exists($dataFile),
                    'writable' => is_writable($dataFile),
                    'size' => file_exists($dataFile) ? filesize($dataFile) : 0
                ]
            ]);
            break;
            
        default:
            $data = readData();
            sendResponse([
                'success' => true,
                'data' => $data,
                'count' => count($data)
            ]);
    }
    
} catch (Exception $e) {
    sendResponse([
        'success' => false,
        'error' => '服务器异常: ' . $e->getMessage()
    ]);
}
?>