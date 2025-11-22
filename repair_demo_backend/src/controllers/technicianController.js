const technicianService = require('../services/technicianService');

exports.listMine = async (req,res,next)=>{
  try {
    const { status } = req.query || {};
    const list = await technicianService.listForTechnician(req.user.sub, status);
    res.json(list);
  } catch(e){ next(e); }
};

exports.checkin = async (req, res, next) => {
  try {
    const { lat, lng } = req.body || {};
    const payload = {
      lat,
      lng,
      technicianId: req.user?.sub,
      technicianName: req.user?.username || req.user?.name || '',
    };
    const updated = await technicianService.checkin(req.params.id, payload);
    // 你也可以只返回 {ok:true}；这里把最新工单返回更方便前端刷新
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    // service 里是 exports.updateStatus(id, status, note)
    const updated = await technicianService.updateStatus(
      req.params.id,
      req.body?.status,
      req.body?.note || ''
    );
    res.json({ ok: true, data: updated });
  } catch (e) { next(e); }
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
    const updated = await technicianService.declineOffer(
      req.params.id,
      req.user.sub,
      req.body?.reason || ''
    );

    if (!updated) {
      return res.status(409).json({ message: '当前状态不可拒绝或不属于你' });
    }

    res.json({
      ok: true,
      message: '已拒绝指派',
      data: updated,
    });
  } catch(e){ next(e); }
};

exports.requestComplete = async (req, res, next) => {
  try {
    const { checkinImages = [], checkinMedia = {} } = req.body || {};

    const result = await technicianService.requestComplete(req.params.id, {
      technicianId: req.user.sub,
      checkinImages,
      checkinMedia,
    });

    res.json({ ok: true, data: result });
  } catch (e) {
    next(e);
  }
};


exports.getReview = async (req,res,next)=>{
  try {
    // 明确只允许查看属于自己的订单评价
    const data = await technicianService.getReview(req.params.id, { technicianId: req.user.sub });
    res.json(data || {});
  } catch(e){ next(e); }
};

// 管理员：获取技师列表
exports.listAll = async (req, res, next) => {
  try {
    const { q } = req.query || {};
    const list = await technicianService.listAll(q);
    res.json(list || []);
  } catch (e) { next(e); }
};

// 管理员：获取审核通过的技师列表（用于指派）
exports.listApproved = async (req, res, next) => {
  try {
    const { q } = req.query || {};
    const list = await technicianService.listApproved(q);
    res.json({ list });
  } catch (e) {
    next(e);
  }
};

