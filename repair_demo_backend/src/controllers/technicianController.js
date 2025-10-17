const technicianService = require('../services/technicianService');

exports.listMine = async (req,res,next)=>{
  try {
    const { status } = req.query || {};
    const list = await technicianService.listForTechnician(req.user.sub, status);
    res.json(list);
  } catch(e){ next(e); }
};

exports.checkin = async (req,res,next)=>{
  try {
    const ok = await technicianService.checkin(req.params.id, req.user.sub, req.body);
    if (!ok) return res.status(400).json({ message:'签到失败' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};

exports.updateStatus = async (req,res,next)=>{
  try {
    const ok = await technicianService.updateStatusByTech(req.params.id, req.user.sub, req.body?.status);
    if (!ok) return res.status(400).json({ message:'更新失败' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};

exports.acceptOffer = async (req,res,next)=>{
  try {
    const ok = await technicianService.acceptOffer(req.params.id, req.user.sub);
    if (!ok) return res.status(400).json({ message:'当前状态不可接受或不属于你' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};

exports.declineOffer = async (req,res,next)=>{
  try {
    const ok = await technicianService.declineOffer(req.params.id, req.user.sub, req.body?.reason || '');
    if (!ok) return res.status(400).json({ message:'当前状态不可拒绝或不属于你' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};

exports.requestComplete = async (req,res,next)=>{
  try {
    const ok = await technicianService.requestComplete(req.params.id, req.user.sub);
    if (!ok) return res.status(400).json({ message:'无法提交完成' });
    res.json({ ok:true });
  } catch(e){ next(e); }
};


exports.getReview = async (req,res,next)=>{
  try {
    // 明确只允许查看属于自己的订单评价
    const data = await technicianService.getReview(req.params.id, { technicianId: req.user.sub });
    res.json(data || {});
  } catch(e){ next(e); }
};