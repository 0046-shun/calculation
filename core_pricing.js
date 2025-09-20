// Core pricing (UMD style) - pure functions exposed via window.CorePricing
(function (global) {
  'use strict';

  function formatNumber(num) {
    if (Number.isInteger(num)) return num.toLocaleString();
    return num.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  function calculateDiscount(baseAmount, discountValue, quantity) {
    var amount = Number(baseAmount) || 0;
    var d = Number(discountValue) || 0;
    var q = Number(quantity);
    if (!q || q < 1) q = 1;
    if (d <= 0) return 0;
    if (d < 100) return Math.floor(amount * (d / 100));
    // 固定金額: 呼び出し側が数量分を反映する場合は quantity を 1 にする
    return Math.min(d * q, amount);
  }

  function calculateKabiPrice(quantity, selectedProducts, productsData) {
    var qty = Number(quantity) || 0;
    var data = productsData && (productsData['そのほか'] && productsData['そのほか']['カビ'] || productsData['消毒'] && productsData['消毒']['カビ']);
    if (!data) return 0;
    var unit = data.price;
    var hasDisinfection = (selectedProducts || []).some(function (p) { return p.category === '消毒'; });
    if (hasDisinfection) return (data.discountPrice || 1000) * qty;
    var hasDiscount2 = (selectedProducts || []).some(function (p) {
      var isKiso = (p.category === '新規工事' || p.category === '追加工事') && p.item && (p.item.indexOf('基礎') !== -1 || p.item.indexOf('クラック') !== -1);
      var hasDC2or60 = p.item && (p.item.indexOf('DC2') !== -1 || p.item.indexOf('60') !== -1);
      return isKiso || hasDC2or60;
    });
    if (hasDiscount2) unit = (data.discount2Price || 1700);
    return unit * qty;
  }

  function calculateBMPrice(quantity, selectedProducts, productsData) {
    var qty = Number(quantity) || 0;
    var bm = productsData && productsData['そのほか'] && productsData['そのほか']['BM'];
    if (!bm) return 0;
    var unit = bm.price;
    var hasExistingDiscount = (selectedProducts || []).some(function (p) {
      if (!bm.discountConditions) return false;
      if (bm.discountConditions.some(function (c) { return c.type === 'category' && c.value === p.category; })) return true;
      if (bm.discountConditions.some(function (c) { return c.type === 'item' && c.value === p.item; })) return true;
      return false;
    });
    var hasKiso = (selectedProducts || []).some(function (p) { return p.item && (p.item.indexOf('外基礎') !== -1 || p.item.indexOf('中基礎') !== -1); });
    if (hasExistingDiscount || hasKiso) unit = bm.discountPrice || unit;
    return unit * qty;
  }

  function calculateSO2BuyPrice(quantity, selectedProducts, productData) {
    var qty = Number(quantity) || 0;
    if (!productData) return 0;
    var hasSpecial = (selectedProducts || []).some(function (p) {
      return p.item && (p.item.indexOf('DC2') !== -1 || p.item.indexOf('60') !== -1 || p.item.indexOf('MJ60') !== -1);
    });
    var unit = hasSpecial ? 83000 : productData.price;
    return unit * qty;
  }

  function calculateNormalProductPrice(productData, quantity) {
    if (!productData) return 0;
    var qty = Number(quantity) || 0;
    var total = productData.base || 0;
    if (productData.areaThreshold) {
      if (qty > productData.areaThreshold) total += (productData.price || 0) * (qty - productData.areaThreshold);
    } else {
      total += (productData.price || 0) * qty;
    }
    return total;
  }

  function calculateKisoPrice(category, itemName, height, length, discountValue, kisoProductsData) {
    var cat = kisoProductsData && kisoProductsData[category];
    var item = cat && cat[itemName];
    if (!item) return { ex: 0, inTax: 0 };
    var hData = item['高さ別価格'] && item['高さ別価格'][String(height)];
    if (!hData) return { ex: 0, inTax: 0 };
    var basePrice = hData['基本価格'];
    var lengthUnit = hData['長さ加算'];
    if (category === 'クラック') {
      basePrice = (lengthUnit || 0) * (Number(length) || 0);
    } else {
      var basicLength = item['基本長さ'];
      if (typeof basicLength !== 'number') basicLength = 20;
      var extra = Math.max(0, (Number(length) || 0) - basicLength);
      basePrice += (lengthUnit || 0) * extra;
    }
    var discount = calculateDiscount(basePrice, Number(discountValue) || 0, 1);
    var ex = basePrice - discount;
    var inTax = Math.floor(ex * 1.1);
    return { ex: ex, inTax: inTax };
  }

  function checkKisoSetDiscount(selectedProducts) {
    var hasGai = (selectedProducts || []).some(function (p) { return p.category === '新規工事' && p.item && p.item.indexOf('外基礎') !== -1; });
    var hasNaka = (selectedProducts || []).some(function (p) { return p.category === '新規工事' && p.item && p.item.indexOf('中基礎') !== -1; });
    return !!(hasGai && hasNaka);
  }

  function calculateProductLine(options) {
    var type = options.type;
    var category = options.category;
    var item = options.item;
    var quantity = options.quantity || 0;
    var discountValue = options.discountValue || 0;
    var height = options.height;
    var length = options.length;
    var productsData = options.productsData;
    var kisoProductsData = options.kisoProductsData;
    var selectedProductsContext = options.selectedProductsContext || [];

    if (type === 'kiso') {
      var k = calculateKisoPrice(category, item, height, length, discountValue, kisoProductsData);
      return { ex: k.ex, inTax: k.inTax };
    }
    var productData = productsData && productsData[category] && productsData[category][item];
    if (!productData) return { ex: 0, inTax: 0 };
    var exTax = 0;
    if ((category === 'そのほか' && item === 'カビ') || (category === '消毒' && item === 'カビ')) {
      exTax = calculateKabiPrice(Number(quantity) || 0, selectedProductsContext, productsData);
    } else if (category === 'そのほか' && item === 'BM') {
      exTax = calculateBMPrice(Number(quantity) || 0, selectedProductsContext, productsData);
    } else if (category === '床下機器' && item === 'SO2買') {
      exTax = calculateSO2BuyPrice(Number(quantity) || 0, selectedProductsContext, productData);
    } else {
      exTax = calculateNormalProductPrice(productData, Number(quantity) || 0);
    }
    var discount = calculateDiscount(exTax, Number(discountValue) || 0, Number(quantity) || 1);
    var ex = exTax - discount;
    var inTax = Math.floor(ex * 1.1);
    return { ex: ex, inTax: inTax };
  }

  global.CorePricing = {
    formatNumber: formatNumber,
    calculateDiscount: calculateDiscount,
    calculateKabiPrice: calculateKabiPrice,
    calculateBMPrice: calculateBMPrice,
    calculateSO2BuyPrice: calculateSO2BuyPrice,
    calculateNormalProductPrice: calculateNormalProductPrice,
    calculateKisoPrice: calculateKisoPrice,
    checkKisoSetDiscount: checkKisoSetDiscount,
    calculateProductLine: calculateProductLine
  };
})(window);


