const adminService = require('../services/adminService');
const ExcelJS = require('exceljs');
const uploadService = require('../services/uploadService');
const axios = require('axios');

// 引入腾讯云SDK
const tencentcloud = require('tencentcloud-sdk-nodejs');
const CvmClient = tencentcloud.cvm.v20170312.Client;

// 云存储相关 - 初始化客户端
let cosClient = null;
function getCosClient() {
  if (!cosClient) {
    // 使用腾讯云COS Node.js SDK
    const COS = require('cos-nodejs-sdk-v5');

    cosClient = new COS({
      SecretId: process.env.TENCENT_SECRET_ID,
      SecretKey: process.env.TENCENT_SECRET_KEY,
    });
  }
  return cosClient;
}

// 工具：把图片地址转为绝对URL（支持传统上传和云存储）
// 长期方案：将微信云开发图片迁移到腾讯COS，返回COS URL
async function absolutizeImages(req, images = []) {
  const results = [];
  for (const u of (images || [])) {
    if (!u) {
      results.push(u);
      continue;
    }

    // 1) 已经是 http(s) 绝对地址 -> 原样返回
    if (/^https?:\/\//i.test(u)) {
      results.push(u);
      continue;
    }

    // 2) 云存储fileID格式 (cloud://) -> 转为特殊标识（短期方案）
    if (u.startsWith('cloud://')) {
      const convertedUrl = await convertCloudFileIdToUrl(u);
      results.push(convertedUrl);
      continue;
    }

    // 3) /api/uploads/xxx -> 转为带域名的绝对地址
    if (u.startsWith('/api/uploads/')) {
      const filename = u.replace('/api/uploads/', '');
      results.push(uploadService.buildPublicUrl(req, filename));
      continue;
    }

    // 4) 仅有文件名 -> 也转绝对地址
    results.push(uploadService.buildPublicUrl(req, u));
  }
  return results;
}

// 云存储fileID转换为可访问URL的辅助函数
// 长期方案：将微信云开发的图片迁移到腾讯云COS，返回COS URL
async function convertCloudFileIdToUrl(fileID) {
  try {
    // 解析fileID格式: cloud://环境ID.小程序AppID/文件路径
    // 例如: cloud://repair-prod-abc123.123456789/image/1640995200000-abc123.jpg

    const match = fileID.match(/^cloud:\/\/([^.]+)\.([^\/]+)\/(.+)$/);
    if (!match) {
      console.warn('无效的云存储fileID格式:', fileID);
      return fileID; // 返回原值
    }

    const [, envId, appId, filePath] = match;

    console.log('长期方案：将微信云开发图片迁移到腾讯云COS');

    // 步骤1：获取微信云开发的临时访问URL
    const tempUrl = await getWechatCloudTempUrl(fileID);
    if (!tempUrl) {
      console.error('获取微信云开发临时URL失败:', fileID);
      return fileID;
    }

    // 步骤2：下载图片数据
    const imageBuffer = await downloadImage(tempUrl);
    if (!imageBuffer) {
      console.error('下载图片失败:', tempUrl);
      return fileID;
    }

    // 步骤3：上传到腾讯云COS
    const cosUrl = await uploadToCos(filePath, imageBuffer);
    if (!cosUrl) {
      console.error('上传到COS失败:', filePath);
      return fileID;
    }

    console.log('图片迁移成功:', fileID, '->', cosUrl);
    return cosUrl;

  } catch (error) {
    console.error('转换云存储fileID失败:', error, fileID);
    // 转换失败时返回原fileID，让前端处理
    return fileID;
  }
}

// 获取微信云开发的临时访问URL
async function getWechatCloudTempUrl(fileID) {
  try {
    // 获取微信access_token
    const accessToken = await getWechatAccessToken();
    if (!accessToken) {
      return null;
    }

    // 调用微信云开发API获取临时URL
    const url = `https://api.weixin.qq.com/tcb/batchdownloadfile?access_token=${accessToken}`;
    const response = await axios.post(url, {
      env: process.env.WECHAT_ENV_ID || 'repair-prod-abc123', // 需要配置环境ID
      file_list: [{
        fileid: fileID,
        max_age: 7200 // 2小时有效期
      }]
    });

    if (response.data.errcode === 0 && response.data.file_list && response.data.file_list.length > 0) {
      return response.data.file_list[0].download_url;
    }

    console.error('获取微信云开发临时URL失败:', response.data);
    return null;
  } catch (error) {
    console.error('获取微信云开发临时URL异常:', error);
    return null;
  }
}

// 获取微信access_token
async function getWechatAccessToken() {
  try {
    const appid = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
    const response = await axios.get(url);

    if (response.data.access_token) {
      return response.data.access_token;
    }

    console.error('获取微信access_token失败:', response.data);
    return null;
  } catch (error) {
    console.error('获取微信access_token异常:', error);
    return null;
  }
}

// 下载图片数据
async function downloadImage(url) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('下载图片失败:', error);
    return null;
  }
}

// 上传到腾讯云COS
async function uploadToCos(filePath, buffer) {
  try {
    const cos = getCosClient();
    const bucket = process.env.COS_BUCKET_NAME;
    const region = process.env.TENCENT_REGION;

    // 根据文件扩展名确定ContentType
    let contentType = 'image/jpeg'; // 默认
    const lowerPath = filePath.toLowerCase();

    if (lowerPath.endsWith('.png')) {
      contentType = 'image/png';
    } else if (lowerPath.endsWith('.gif')) {
      contentType = 'image/gif';
    } else if (lowerPath.endsWith('.webp')) {
      contentType = 'image/webp';
    } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (lowerPath.endsWith('.mp4')) {
      contentType = 'video/mp4';
    } else if (lowerPath.endsWith('.webm')) {
      contentType = 'video/webm';
    } else if (lowerPath.endsWith('.mov')) {
      contentType = 'video/quicktime';
    } else if (lowerPath.endsWith('.avi')) {
      contentType = 'video/x-msvideo';
    }

    return new Promise((resolve, reject) => {
      cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
      }, (err, data) => {
        if (err) {
          console.error('上传到COS失败:', err);
          reject(err);
        } else {
          const url = `https://${bucket}.cos.${region}.myqcloud.com/${filePath}`;
          resolve(url);
        }
      });
    });
  } catch (error) {
    console.error('上传到COS异常:', error);
    return null;
  }
}

// 列出订单
exports.listOrders = async (req, res, next) => {
  try {
    const { status } = req.query || {};
    const orders = await adminService.listForAdmin(status);
    const data = [];
    for (const o of (orders || [])) {
      const processedOrder = {
        ...o,
        images: await absolutizeImages(req, o.images)
      };
      data.push(processedOrder);
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// 获取订单详情（含绝对URL的图片）
exports.getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const o = await adminService.getOrderById(id);
    if (!o) return res.status(404).json({ message: '订单不存在' });
    o.images = await absolutizeImages(req, o.images);
    // 如果后面还会预览评价图片，也可一并绝对化
    if (Array.isArray(o.reviews)) {
      for (let i = 0; i < o.reviews.length; i++) {
        o.reviews[i] = {
          ...o.reviews[i],
          images: await absolutizeImages(req, o.reviews[i].images)
        };
      }
    }
    res.json(o);
  } catch (e) { next(e); }
}

// 指派订单
exports.assignOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { technicianId, technicianName } = req.body || {};
    if (!technicianId) return res.status(400).json({ message: '缺少技师ID' });

    const adminInfo = {
      adminId: req.user?.sub || '',
      adminName: req.user?.username || 'admin',
    };

    const order = await adminService.assignOrder(id, {
      technicianId,
      technicianName: technicianName || '',
      ...adminInfo,
    });

    if (!order) return res.status(404).json({ message: '订单不存在' });

    res.json({ ok: true, data: order, message: '指派成功' });
  } catch (err) {
    next(err);
  }
};

// 导出订单为 Excel
exports.exportOrders = async (req, res, next) => {
  try {
    const { status, from, to } = req.query || {};
    const orders = await adminService.exportOrders({ status, from, to });

    // 创建 Excel 工作簿
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('订单');

    // 定义表头
    sheet.columns = [
      { header: '订单编号', key: 'id', width: 18 },
      { header: '客户名', key: 'customer', width: 15 },
      { header: '联系电话', key: 'phone', width: 15 },
      { header: '设备', key: 'device', width: 20 },
      { header: '故障描述', key: 'issue', width: 25 },
      { header: '地址', key: 'address', width: 25 },
      { header: '状态', key: 'status', width: 15 },
      { header: '技师姓名', key: 'technicianName', width: 15 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '更新时间', key: 'updatedAt', width: 20 },
    ];

    // 写入数据
    orders.forEach((o) => {
      sheet.addRow({
        id: o.id || o._id,
        customer: o.customer,
        phone: o.phone,
        device: o.device,
        issue: o.issue,
        address: o.address,
        status: o.status,
        technicianName: o.technicianName || '',
        createdAt: new Date(o.createdAt).toLocaleString(),
        updatedAt: new Date(o.updatedAt).toLocaleString(),
      });
    });

    // 响应头
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="orders_${new Date().toISOString().slice(0, 10)}.xlsx"`
    );
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
};

// ========= 技师审核 =========
exports.listTechnicians = async (req, res, next) => {
  try {
    const { status, q, page, pageSize } = req.query || {};
    const data = await adminService.listTechnicians({ status, q, page, pageSize });
    res.json(data);
  } catch (e) { next(e); }
};

exports.getTechnician = async (req, res, next) => {
  try {
    const data = await adminService.getTechnician(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
};

exports.approveTechnician = async (req, res, next) => {
  try {
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.approveTechnician(req.params.id, { adminId, adminName });
    res.json({ ok: true, message: '审核已通过', data });
  } catch (e) { next(e); }
};

exports.rejectTechnician = async (req, res, next) => {
  try {
    const reason = req.body?.reason || '';
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.rejectTechnician(req.params.id, reason, { adminId, adminName });
    res.json({ ok: true, message: '已驳回', data });
  } catch (e) { next(e); }
};

// 管理员修改订单状态
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body || {};
    if (!status) return res.status(400).json({ message: '缺少目标状态 status' });

    const adminInfo = {
      adminId: req.user?.sub || '',
      adminName: req.user?.username || 'admin',
    };

    const updated = await adminService.updateOrderStatus(id, status, {
      reason: reason || '',
      ...adminInfo,
    });
    res.json({ ok: true, data: updated, message: '状态已更新' });
  } catch (err) {
    next(err);
  }
};

// ========= 客户审核（与技师审核同结构）=========
exports.listCustomers = async (req, res, next) => {
  try {
    const { status, q, page, pageSize } = req.query || {};
    const data = await adminService.listCustomers({ status, q, page, pageSize });
    res.json(data);
  } catch (e) { next(e); }
};

exports.getCustomer = async (req, res, next) => {
  try {
    const data = await adminService.getCustomer(req.params.id);
    res.json(data);
  } catch (e) { next(e); }
};

exports.approveCustomer = async (req, res, next) => {
  try {
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.approveCustomer(req.params.id, { adminId, adminName });
    res.json({ ok: true, message: '审核已通过', data });
  } catch (e) { next(e); }
};

exports.rejectCustomer = async (req, res, next) => {
  try {
    const reason = req.body?.reason || '';
    const adminId = req.user?.sub, adminName = req.user?.username || 'admin';
    const data = await adminService.rejectCustomer(req.params.id, reason, { adminId, adminName });
    res.json({ ok: true, message: '已驳回', data });
  } catch (e) { next(e); }
};

// ========== 完成审核：管理员同意 ==========
exports.approveComplete = async (req, res, next) => {
  try {
    const adminId = req.user?.sub || '';
    const adminName = req.user?.username || 'admin';
    const result = await adminService.approveComplete(req.params.id, {
      adminId,
      adminName
    });
    res.json({ ok: true, message: '订单已审核通过', data: result });
  } catch (err) {
    next(err);
  }
};

// ========== 完成审核：管理员驳回 ==========
exports.rejectComplete = async (req, res, next) => {
  try {
    const adminId = req.user?.sub || '';
    const adminName = req.user?.username || 'admin';
    const reason = req.body?.reason || '';
    const result = await adminService.rejectComplete(req.params.id, reason, {
      adminId,
      adminName
    });
    res.json({ ok: true, message: '已驳回完成申请', data: result });
  } catch (err) {
    next(err);
  }
};

// 公开辅助函数（保留已有 exports）
exports.convertCloudFileIdToUrl = convertCloudFileIdToUrl;
exports.absolutizeImages = absolutizeImages;
