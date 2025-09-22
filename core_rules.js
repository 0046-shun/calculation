(function (global) {
  var CoreRules = global.CoreRules || {};
  CoreRules.rules = CoreRules.rules || [];

  function isStringEqual(a, b) {
    return String(a || '') === String(b || '');
  }

  // ルール型: co-occur-unit-override（商品名対商品名で適用）
  // when: { targetCategory, targetItem, conditionCategory, conditionItem }
  // apply: { unitPrice }
  function findUnitOverride(category, item, context) {
    if (!Array.isArray(CoreRules.rules) || CoreRules.rules.length === 0) return null;

    function ctxHasCondition(condCat, condItem) {
      // 商品名一致が最重要。カテゴリは補助（未指定可）
      return (context || []).some(function (p) {
        var itemOk = isStringEqual(p.item, condItem);
        var catOk = (!condCat || isStringEqual(p.category, condCat));
        return itemOk && catOk;
      });
    }

    for (var i = 0; i < CoreRules.rules.length; i++) {
      var r = CoreRules.rules[i];
      if (r.status !== 'published') continue;
      if (r.ruleType !== 'co-occur-unit-override') continue;
      var w = r.when || {};
      var isTarget = isStringEqual(item, w.targetItem) && (!w.targetCategory || isStringEqual(category, w.targetCategory));
      if (!isTarget) continue;
      if (!ctxHasCondition(w.conditionCategory, w.conditionItem)) continue;
      var unit = Number((r.apply || {}).unitPrice);
      // 単価0以下の上書きは無効として無視（無料化は別手段想定）
      if (isFinite(unit) && unit > 0) return unit;
    }
    return null;
  }

  CoreRules.getUnitOverride = findUnitOverride;

  CoreRules.load = function (db) {
    if (!db || !db.collection) return Promise.resolve({ loaded: 0 });
    return db.collection('rules').where('status', 'in', ['published','draft']).get().then(function (snap) {
      var arr = [];
      snap.forEach(function (d) { arr.push(Object.assign({ id: d.id }, d.data())); });
      CoreRules.rules = arr;
      return { loaded: arr.length };
    });
  };

  CoreRules.autoLoad = function () {
    try {
      if (global.FEATURE_USE_FIRESTORE && global.firebase && global.firebase.firestore) {
        var appInited = (global.firebase.apps && global.firebase.apps.length) ? true : false;
        if (!appInited) global.firebase.initializeApp(global.FIREBASE_CONFIG || {});
        var db = global.firebase.firestore();
        return CoreRules.load(db);
      }
    } catch (_) {}
    return Promise.resolve({ loaded: 0 });
  };

  // 複雑ロジック（外基礎・中基礎同時契約時）
  // 4万円値引き＋名称の括弧付け (外基礎・中基礎)▲セット
  // ここでは判定関数のみ提供（表示名の加工はUI側で適用）
  CoreRules.checkKisoBundleDiscount = function (context) {
    var hasOuter = (context || []).some(function (p) { return String(p.item).indexOf('外基礎') !== -1; });
    var hasInner = (context || []).some(function (p) { return String(p.item).indexOf('中基礎') !== -1; });
    return (hasOuter && hasInner) ? 40000 : 0;
  };

  global.CoreRules = CoreRules;
})(window);
