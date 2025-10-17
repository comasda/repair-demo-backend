const customerService = require('../services/customerService');

exports.create = async (req,res,next)=>{
  try {
    const doc = await customerService.create({ ...req.body, customerId: req.user.sub });
    res.json(doc);
  } catch(e){ next(e); }
};

exports.listMine = async (req,res,next)=>{
  try {
    const { status } = req.query || {};
    const list = await customerService.listForCustomer(req.user.sub, status);
    res.json(list);
  } catch(e){ next(e); }
};

exports.detailSafe = async (req,res,next)=>{
  try {
    const doc = await customerService.getByIdSafe(req.params.id, req.user);
    if (!doc) return res.status(404).json({ message:'无权或不存在' });
    res.json(doc);
  } catch(e){ next(e); }
};

exports.confirmComplete = async (req,res,next)=>{
  try {
    const ok = await customerService.confirmComplete(req.params.id, req.user.sub);
    if (!ok) return res.status(400).json({ message:'当前状态不可确认或无权操作' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};

exports.addReview = async (req,res,next)=>{
  try {
    // 从登录态注入 customerId / customerName，避免前端漏传或伪造
    const { rating, content, images } = req.body || {};
    const payload = {
      customerId: req.user.sub,
      customerName: req.user.username || '',
      rating,
      content,
      images
    };
    const ok = await customerService.addReview(req.params.id, payload);
    if (!ok) return res.status(400).json({ message:'评价失败' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};
