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