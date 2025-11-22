const { Server } = require('socket.io');

let io;
const connectedUsers = new Map(); // 用于存储在线用户, 格式: userId -> socketId

/**
 * 初始化 Socket.IO 服务器
 * @param {http.Server} httpServer - Node 的 HTTP 服务器实例
 */
const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // 允许所有来源
      methods: ["GET", "POST"],
      credentials: true
    },
    path: '/socket.io', // 明确指定 Socket.IO 路径
    transports: ['polling', 'websocket'], // 优先使用轮询，再尝试 WebSocket
    allowEIO3: true, // 允许 Engine.IO v3
    pingTimeout: 60000, // 60秒超时
    pingInterval: 25000 // 25秒心跳
  });

  // 监听客户端连接
  io.on('connection', (socket) => {
    // 客户端在认证后，会发送 'register' 事件来注册自己的用户ID
    socket.on('register', (userId) => {
      if (userId) {
        connectedUsers.set(userId.toString(), socket.id);
      }
    });

    // 监听连接断开
    socket.on('disconnect', () => {
      // 从在线用户列表中移除
      for (let [userId, id] of connectedUsers.entries()) {
        if (id === socket.id) {
          connectedUsers.delete(userId);
          break;
        }
      }
    });
  });
};

/**
 * 向特定用户发送消息
 * @param {string} userId - 目标用户的ID
 * @param {string} event - 事件名称
 * @param {object} data - 要发送的数据
 */
const sendToUser = (userId, event, data) => {
  if (!io) return;
  const socketId = connectedUsers.get(userId.toString());
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

/**
 * 向所有连接的客户端广播消息
 * @param {string} event - 事件名称
 * @param {object} data - 要发送的数据
 */
const broadcast = (event, data) => {
    if (!io) {
      return;
    }
    io.emit(event, data);
};

module.exports = {
  init,
  sendToUser,
  broadcast,
};
