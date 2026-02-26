// 测试云存储fileID转换功能
// 运行: node test-cloud-storage.js

require('dotenv').config();
const { convertCloudFileIdToUrl } = require('./src/controllers/adminController');

// 测试用例
async function testCloudStorage() {
  console.log('测试云存储fileID转换功能...\n');

  // 测试无效的fileID
  try {
    const result1 = await convertCloudFileIdToUrl('invalid-file-id');
    console.log('无效fileID测试:', result1);
  } catch (error) {
    console.log('无效fileID测试失败:', error.message);
  }

  // 测试有效的fileID格式（如果配置了COS）
  const testFileId = 'cloud://repair-prod-abc123.123456789/image/test.jpg';
  try {
    const result2 = await convertCloudFileIdToUrl(testFileId);
    console.log('有效fileID测试:', result2);
  } catch (error) {
    console.log('有效fileID测试失败:', error.message);
  }

  console.log('\n测试完成。如果看到fileID原样返回，说明未配置COS环境变量。');
}

testCloudStorage();