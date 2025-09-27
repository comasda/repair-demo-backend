const Technician = require('../models/Technician');

exports.list = async (req, res, next) => {
  try {
    const list = await Technician.find().sort({ createdAt: 1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name 不能为空' });
    const t = await Technician.create({ name });
    res.json(t);
  } catch (err) {
    next(err);
  }
};
