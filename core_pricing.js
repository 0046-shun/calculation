(function (global) {
  var CorePricing = global.CorePricing || {};

  function toNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function calculateDiscount(exTax, discountValue) {
    var ex = toNumber(exTax, 0);
    var d = toNumber(discountValue, 0);
    if (d <= 0) return 0;
    // percentage (<100) or fixed (>=100), cap at exTax
    var amount = d < 100 ? ex * (d / 100) : d;
    if (amount > ex) amount = ex;
    return amount;
  }

  function includesAny(text, keywords) {
    if (!text) return false;
    var s = String(text);
    return keywords.some(function (kw) { return s.indexOf(kw) !== -1; });
  }

  function calculateNormalProductPrice(productData, quantity, category, item, selectedProductsContext) {
    var q = toNumber(quantity, 0);
    if (!productData) return 0;
    var base = toNumber(productData.base, 0);
    var unit = toNumber(productData.price, 0);

    // ルールによる単価上書き（同時契約など）
    try {
      if (global.CoreRules && typeof global.CoreRules.getUnitOverride === 'function') {
        var override = global.CoreRules.getUnitOverride(category, item, selectedProductsContext || []);
        // 0以下の単価上書きは無視
        if (isFinite(override) && Number(override) > 0) unit = Number(override);
      }
    } catch (_) {}

    var threshold = productData.areaThreshold;
    if (typeof threshold === 'number' && isFinite(threshold)) {
      if (q > threshold) {
        return base + (q - threshold) * unit;
      }
      return base;
    }
    return base + q * unit;
  }

  function calculateKabiPrice(quantity, selectedProductsContext, productsData) {
    var q = toNumber(quantity, 0);
    if (q <= 0) return 0;
    // defaults
    var unit = 2500;
    var hasShodoku = selectedProductsContext.some(function (p) { return p.category === '消毒'; });
    var hasKisoOr60OrDC2 = selectedProductsContext.some(function (p) {
      return p.category === '基礎' || includesAny(p.item, ['DC2', '60']);
    });
    // 優先度: 消毒(1000)優先、次に DC2/60/基礎(1700)
    if (hasShodoku) unit = 1000;
    else if (hasKisoOr60OrDC2) unit = 1700;
    return unit * q;
  }

  function calculateBMPrice(quantity, selectedProductsContext, productsData) {
    var q = toNumber(quantity, 0);
    if (q <= 0) return 0;
    var unit = 3300;
    var eligible = selectedProductsContext.some(function (p) {
      if (p.category === '消毒' || p.category === '基礎') return true;
      return includesAny(p.item, ['SO2(DC2)新', 'SO2(DC2)買', 'SO260新', 'SO260買']);
    });
    if (eligible) unit = 2800;
    return unit * q;
  }

  function calculateSO2BuyPrice(quantity, selectedProductsContext, productData) {
    var q = toNumber(quantity, 0);
    if (q <= 0) return 0;
    // 併用: DC2 が選択に含まれると 83,000、単体は 88,000（productData.price 優先）
    var hasDC2 = selectedProductsContext.some(function (p) { return includesAny(p.item, ['DC2']); });
    var unit = hasDC2 ? 83000 : toNumber(productData && productData.price, 88000);
    return unit * q;
  }

  function calculateKisoPrice(category, item, height, length, discountValue, kisoProductsData) {
    if (!kisoProductsData || !kisoProductsData[category] || !kisoProductsData[category][item]) {
      return { ex: 0, inTax: 0 };
    }
    var productData = kisoProductsData[category][item];
    var heights = productData['高さ別価格'] || {};
    var hData = heights[String(height)] || heights[height];
    if (!hData) return { ex: 0, inTax: 0 };
    var base = toNumber(hData['基本価格'], 0);
    var perLen = toNumber(hData['長さ加算'], 0);
    var basicLen = toNumber(productData['基本長さ'], 0);
    // Firestoreなどで基本長さが未設定の場合のフォールバック
    if (!isFinite(basicLen) || basicLen === 0) {
      basicLen = (String(category) === 'クラック') ? 1 : 20;
    }
    var len = toNumber(length, 0);

    var exTax = base;
    if (len > basicLen) exTax += (len - basicLen) * perLen;

    var discount = calculateDiscount(exTax, discountValue);
    var ex = Math.max(0, exTax - discount);
    var inTax = Math.floor(ex * 1.1);
    return { ex: ex, inTax: inTax };
  }

  function checkKisoSetDiscount(selectedProductsContext) {
    return selectedProductsContext.some(function (p) { return includesAny(p.item, ['外基礎', '中基礎']); });
  }

  function calculateProductLine(options) {
    var type = options.type;
    var category = options.category;
    var item = options.item;
    var quantity = toNumber(options.quantity, 0);
    var discountValue = toNumber(options.discountValue, 0);
    var height = options.height;
    var length = options.length;
    var productsData = options.productsData || global.productsData;
    var kisoProductsData = options.kisoProductsData || global.kisoProductsData;
    var selectedProductsContext = options.selectedProductsContext || [];

    if (type === 'kiso') {
      return calculateKisoPrice(category, item, height, length, discountValue, kisoProductsData);
    }

    if (!productsData || !productsData[category] || !productsData[category][item]) {
      return { ex: 0, inTax: 0 };
    }
    var productData = productsData[category][item];
    var exTax = 0;

    if ((category === 'そのほか' && item === 'カビ') || (category === '消毒' && item === 'カビ')) {
      exTax = calculateKabiPrice(quantity, selectedProductsContext, productsData);
    } else if (category === 'そのほか' && item === 'BM') {
      exTax = calculateBMPrice(quantity, selectedProductsContext, productsData);
    } else if (category === '床下機器' && item === 'SO2買') {
      exTax = calculateSO2BuyPrice(quantity, selectedProductsContext, productData);
    } else {
      exTax = calculateNormalProductPrice(productData, quantity, category, item, selectedProductsContext);
    }

    var discount = calculateDiscount(exTax, discountValue);
    var ex = Math.max(0, exTax - discount);
    var inTax = Math.floor(ex * 1.1);
    return { ex: ex, inTax: inTax };
  }

  CorePricing.calculateDiscount = calculateDiscount;
  CorePricing.calculateKabiPrice = calculateKabiPrice;
  CorePricing.calculateBMPrice = calculateBMPrice;
  CorePricing.calculateSO2BuyPrice = calculateSO2BuyPrice;
  CorePricing.calculateNormalProductPrice = calculateNormalProductPrice;
  CorePricing.calculateKisoPrice = calculateKisoPrice;
  CorePricing.checkKisoSetDiscount = checkKisoSetDiscount;
  CorePricing.calculateProductLine = calculateProductLine;

  global.CorePricing = CorePricing;
})(window);
