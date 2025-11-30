<?php
// server-simple.php - 极简版本的服务器
// 强制设置为纯文本先，然后改为JSON
header('Content-Type: text/plain');

// 数据文件
$dataFile = 'feedback_data.json';

// 确保数据文件存在
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, '[]');
}

// 获取动作
$action = $_GET['action'] ?? 'get_all';

// 设置JSON头
header('Content-Type: application/json; charset=utf-8');

try {
    if ($action === 'get_all') {
        $data = file_exists($dataFile) ? file_get_contents($dataFile) : '[]';
        $decoded = json_decode($data, true) ?: [];
        
        echo json_encode([
            'success' => true,
            'data' => $decoded,
            'count' => count($decoded)
        ]);
        
    } elseif ($action === 'save_feedback') {
        $input = $_GET['data'] ?? '';
        
        if (empty($input)) {
            echo json_encode(['success' => false, 'error' => 'No data']);
            exit;
        }
        
        // 读取现有数据
        $currentData = file_exists($dataFile) ? file_get_contents($dataFile) : '[]';
        $dataArray = json_decode($currentData, true) ?: [];
        
        // 解析新数据
        $newData = json_decode(urldecode($input), true);
        if (!$newData) {
            echo json_encode(['success' => false, 'error' => 'Invalid data format']);
            exit;
        }
        
        // 添加系统字段
        $newData['id'] = uniqid();
        $newData['timestamp'] = date('c');
        $newData['status'] = 'pending';
        
        // 添加到数组
        $dataArray[] = $newData;
        
        // 保存
        if (file_put_contents($dataFile, json_encode($dataArray, JSON_PRETTY_PRINT))) {
            echo json_encode([
                'success' => true,
                'id' => $newData['id'],
                'message' => 'Saved successfully'
            ]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Save failed']);
        }
        
    } elseif ($action === 'test') {
        echo json_encode([
            'success' => true,
            'message' => 'Server is working',
            'timestamp' => date('c')
        ]);
        
    } else {
        echo json_encode(['success' => false, 'error' => 'Unknown action']);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'error' => 'Server error: ' . $e->getMessage()
    ]);
}
?>