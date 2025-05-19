// utils.js - 确保使用完整路径
async function fetchUserData(authCode) {
  try {
    // 修正路径（相对于HTML文件的位置）
    const response = await fetch('../data/data.json'); 
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    const user = data.find(user => user.id === authCode);
    
    if (!user) {
      console.warn('用户不存在:', authCode);
      return null;
    }
    
    console.log('找到用户:', user.name); // 调试日志
    return user;
  } catch (error) {
    console.error('数据加载失败:', error);
    return null;
  }
}