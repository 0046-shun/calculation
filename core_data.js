// Data helpers (UMD) - validate and index goods/kiso data
(function (global) {
  'use strict';

  function validateGoodsData(goodsData) {
    var issues = [];
    if (!goodsData || typeof goodsData !== 'object') {
      issues.push('goodsData is missing or not an object');
      return issues;
    }
    Object.keys(goodsData).forEach(function (category) {
      var items = goodsData[category] || {};
      Object.keys(items).forEach(function (name) {
        var d = items[name] || {};
        if (typeof d.price === 'undefined' && typeof d.base === 'undefined') {
          issues.push('[' + category + '/' + name + '] has neither price nor base');
        }
      });
    });
    return issues;
  }

  function validateKisoData(kisoData) {
    var issues = [];
    if (!kisoData || typeof kisoData !== 'object') {
      issues.push('kisoProductsData is missing or not an object');
      return issues;
    }
    Object.keys(kisoData).forEach(function (category) {
      var items = kisoData[category] || {};
      Object.keys(items).forEach(function (name) {
        var d = items[name] || {};
        if (!d['高さ別価格']) {
          issues.push('[' + category + '/' + name + '] missing 高さ別価格');
        }
      });
    });
    return issues;
  }

  function buildGoodsIndex(goodsData) {
    // returns flat list [{category,item,data}]
    var list = [];
    if (!goodsData) return list;
    Object.keys(goodsData).forEach(function (category) {
      Object.keys(goodsData[category] || {}).forEach(function (item) {
        list.push({ category: category, item: item, data: goodsData[category][item] });
      });
    });
    return list;
  }

  function normalizeGoods(goodsData) {
    var result = {};
    var normalizeName = (global.CoreUtils && global.CoreUtils.normalizeProductName) || function (s) { return (s||'').toLowerCase(); };
    Object.keys(goodsData || {}).forEach(function (category) {
      result[category] = result[category] || {};
      Object.keys(goodsData[category] || {}).forEach(function (item) {
        var norm = normalizeName(item);
        result[category][norm] = goodsData[category][item];
      });
    });
    return result;
  }

  function normalizeKiso(kisoData) {
    var result = {};
    var normalizeName = (global.CoreUtils && global.CoreUtils.normalizeProductName) || function (s) { return (s||'').toLowerCase(); };
    Object.keys(kisoData || {}).forEach(function (category) {
      result[category] = result[category] || {};
      Object.keys(kisoData[category] || {}).forEach(function (item) {
        var norm = normalizeName(item);
        result[category][norm] = kisoData[category][item];
      });
    });
    return result;
  }

  // ----- Schema adapters (for Firestore migration preview) -----
  function goodsToSchema(goodsData) {
    var out = [];
    if (!goodsData) return out;
    Object.keys(goodsData).forEach(function (category) {
      Object.keys(goodsData[category] || {}).forEach(function (itemName) {
        var d = goodsData[category][itemName] || {};
        var schema = {
          category: category,
          itemName: itemName,
          unitLabel: null,
          status: 'published',
          pricing: {
            base: typeof d.base === 'number' ? d.base : 0,
            unitPrice: typeof d.price === 'number' ? d.price : 0,
            basicQty: typeof d.areaThreshold === 'number' ? d.areaThreshold : null,
            excessCalc: typeof d.areaThreshold === 'number' ? 'overOnly' : 'perQty'
          },
          rules: [],
          tags: []
        };
        // Kabi rules
        if ((category === 'そのほか' && itemName === 'カビ') || (category === '消毒' && itemName === 'カビ')) {
          schema.tags.push('特則:カビ対象');
          schema.rules.push({ when: { category: '消毒' }, apply: { unitPrice: d.discountPrice || 1000 }, scope: 'カビ' });
          schema.rules.push({ when: { itemIncludes: ['DC2', '60', 'MJ60'] }, apply: { unitPrice: d.discount2Price || 1700 }, scope: 'カビ' });
        }
        // BM rules (category/item triggers)
        if (category === 'そのほか' && itemName === 'BM') {
          schema.tags.push('特則:BM対象');
          schema.rules.push({ when: { category: '消毒' }, apply: { unitPrice: d.discountPrice || 2800 }, scope: 'BM' });
          schema.rules.push({ when: { itemIncludes: ['外基礎', '中基礎'] }, apply: { unitPrice: d.discountPrice || 2800 }, scope: 'BM' });
        }
        // SO2買 特則（DC2/MJ60 同行）
        if (category === '床下機器' && itemName === 'SO2買') {
          schema.tags.push('特則:SO2買');
          schema.rules.push({ when: { itemIncludes: ['DC2', 'MJ60', '60'] }, apply: { unitPrice: 83000 }, scope: 'SO2買' });
        }
        out.push(schema);
      });
    });
    return out;
  }

  function kisoToSchema(kisoData) {
    var out = [];
    if (!kisoData) return out;
    Object.keys(kisoData).forEach(function (category) {
      Object.keys(kisoData[category] || {}).forEach(function (itemName) {
        var d = kisoData[category][itemName] || {};
        var pricingByHeight = {};
        var src = d['高さ別価格'] || {};
        Object.keys(src).forEach(function (h) {
          var hData = src[h] || {};
          pricingByHeight[h] = {
            basicPrice: hData['基本価格'] || 0,
            lengthUnitPrice: hData['長さ加算'] || 0,
            basicLength: d['基本長さ'] || (category === 'クラック' ? 1 : 20)
          };
        });
        out.push({
          category: category,
          itemName: itemName,
          unitLabel: category === 'クラック' ? '個' : 'm',
          status: 'published',
          pricingByHeight: pricingByHeight,
          rules: []
        });
      });
    });
    return out;
  }

  global.CoreData = {
    validateGoodsData: validateGoodsData,
    validateKisoData: validateKisoData,
    buildGoodsIndex: buildGoodsIndex,
    normalizeGoods: normalizeGoods,
    normalizeKiso: normalizeKiso,
    goodsToSchema: goodsToSchema,
    kisoToSchema: kisoToSchema
  };
})(window);


