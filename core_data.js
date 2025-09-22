(function (global) {
  if (!global.CoreData) {
    global.CoreData = {};
  }
  function normalizeGoodsIdentity(goods) {
    return goods || {};
  }
  function normalizeKisoIdentity(kiso) {
    return kiso || {};
  }
  global.CoreData.normalizeGoods = global.CoreData.normalizeGoods || normalizeGoodsIdentity;
  global.CoreData.normalizeKiso = global.CoreData.normalizeKiso || normalizeKisoIdentity;
})(window);
