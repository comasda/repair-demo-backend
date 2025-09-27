require('dotenv').config();
const { connectDB } = require('./db');
const Technician = require('./models/Technician');
const Order = require('./models/Order');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/repair_demo';

const mockOrders = [
  { id: '20240810-001', customer: '张先生', customerId: 'cust-001', device: '制冷冰箱', issue: '不制冷', time: '2024-08-10 09:30', status: 'pending', technicianId: null, technicianName: null, history: [{ time: '2024-08-10 09:30', note: '客户发起报修' }] },
  { id: '20240809-002', customer: '王女士', customerId: 'cust-002', device: '燃气灶', issue: '打不着火', time: '2024-08-09 15:45', status: 'pending', technicianId: null, technicianName: null, history: [{ time: '2024-08-09 15:45', note: '客户发起报修' }] },
  { id: '20240809-001', customer: '李先生', customerId: 'cust-003', device: '油烟机', issue: '吸力弱', time: '2024-08-09 11:20', status: 'pending', technicianId: null, technicianName: null, history: [{ time: '2024-08-09 11:20', note: '客户发起报修' }] },
  { id: '20240808-001', customer: '张先生', customerId: 'cust-001', device: '消毒柜', issue: '无法开门', time: '2024-08-08 11:20', status: 'assigned', technicianId: 'tech-001', technicianName: '陈师傅', history: [{ time: '2024-08-08 11:20', note: '客户发起报修' }, { time: '2024-08-08 12:00', note: '工单已指派给陈师傅' }] }
];

async function run() {
  await connectDB(MONGO_URI);
  console.log('[SEED] Start seeding...');

  await Technician.deleteMany({});
  await Technician.insertMany([
    { name: '陈师傅' },
    { name: '林师傅' },
    { name: '周师傅' }
  ]);
  console.log('[SEED] Technicians inserted.');

  await Order.deleteMany({});
  await Order.insertMany(mockOrders);
  console.log('[SEED] Orders inserted.');

  console.log('[SEED] Done.');
  process.exit(0);
}

run().catch(err => {
  console.error('[SEED] Failed:', err);
  process.exit(1);
});
