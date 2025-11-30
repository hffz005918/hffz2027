<?php
// server-fixed.php - 绝对可靠的服务器版本
// 必须在文件最开始设置header，不能有任何输出

// 设置响应头
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// 关闭所有错误输出
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(0);

// 数据文件
$dataFile = 'feedback_data.json';

// 统一的响应函数
function sendJson($data) {
    // 清除任何可能的输出缓冲区
    if (ob_get_level()) {
        ob_clean();
    }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// 确保数据文件存在
function initDataFile() {
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
    $content = @file_get_contents($dataFile);
    if ($content === false) {
        return [];
    }
    $data = @json_decode($content, true);
    return is_array($data) ? $data : [];
}

// 保存数据
function saveData($data) {
    global $dataFile;
    $json = @json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return @file_put_contents($dataFile, $json) !== false;
}

// 主程序开始 - 确保没有前置输出
try {
    // 初始化数据文件
    if (!initDataFile()) {
        sendJson(['success' => false, 'error' => '无法初始化数据文件']);
    }

    // 获取动作
    $action = isset($_GET['action']) ? $_GET['action'] : 'get_all';

    switch ($action) {
        case 'get_all':
            $data = readData();
            sendJson([
                'success' => true,
                'data' => $data,
                'count' => count($data),
                'timestamp' => date('c')
            ]);
            break;

        case 'save_feedback':
            $input = isset($_GET['data']) ? $_GET['data'] : '';
            if (empty($input)) {
                sendJson(['success' => false, 'error' => '没有接收到数据']);
            }

            // URL解码
            $decoded = urldecode($input);
            $feedback = @json_decode($decoded, true);
            
            if (json_last_error() !== JSON_ERROR_NONE) {
                sendJson(['success' => false, 'error' => '数据格式错误']);
            }

            // 验证必要字段
            if (empty($feedback['content'])) {
                sendJson(['success' => false, 'error' => '反馈内容不能为空']);
            }

            // 准备数据
            $feedbackData = [
                'id' => 'fb_' . time() . '_' . rand(1000, 9999),
                'employeeName' => isset($feedback['employeeName']) ? $feedback['employeeName'] : '',
                'type' => isset($feedback['type']) ? $feedback['type'] : 'other',
                'content' => $feedback['content'],
                'images' => isset($feedback['images']) ? $feedback['images'] : [],
                'timestamp' => date('c'),
                'status' => 'pending',
                'likes' => 0,
                'comments' => []
            ];

            // 保存
            $allData = readData();
            $allData[] = $feedbackData;
            
            if (saveData($allData)) {
                sendJson([
                    'success' => true,
                    'id' => $feedbackData['id'],
                    'message' => '保存成功',
                    'count' => count($allData)
                ]);
            } else {
                sendJson(['success' => false, 'error' => '保存失败']);
            }
            break;

        case 'test':
            sendJson([
                'success' => true,
                'message' => '服务器正常工作',
                'timestamp' => date('c'),
                'file_info' => [
                    'exists' => file_exists($dataFile),
                    'writable' => is_writable($dataFile),
                    'size' => filesize($dataFile)
                ]
            ]);
            break;

        default:
            sendJson(['success' => false, 'error' => '未知操作']);
    }

} catch (Exception $e) {
    sendJson(['success' => false, 'error' => '服务器异常']);
}
?>