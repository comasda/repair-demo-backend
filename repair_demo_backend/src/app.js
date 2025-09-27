require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./../src/db');
const users = require('./routes/users');
const orders = require('./routes/orders');
const technicians = require('./routes/technicians');
const { errorHandler } = require('./middleware/error');

const app = express();

const PORT = process.env.PORT || 8080;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/repair_demo';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim());

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/users', users);
app.use('/api/orders', orders);
app.use('/api/technicians', technicians);
app.use((req, res, next) => {
  console.log(`[请求] ${req.method} ${req.url}`, req.body || {})
  next()
})

app.use(errorHandler);

connectDB(MONGO_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`[API] Listening on port ${PORT}`);
  });
}).catch(err => {
  console.error('[DB] Connection failed:', err);
  process.exit(1);
});
