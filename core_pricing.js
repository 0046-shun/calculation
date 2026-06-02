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
    // 値引き後の金額を切り上げるため、値引き額は切り捨て
    var amount = d < 100 ? Math.floor(ex * (d / 100)) : d;
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
        if (isFinite(override) && Number(override) > 0) {
          unit = Number(override);
        }
      }
    } catch (error) {
      // ルール適用エラーは無視
    }

    var threshold = productData.areaThreshold;
    if (typeof threshold === 'number' && isFinite(threshold)) {
      if (q > threshold) {
        // 浮動小数点誤差を防ぐため、計算結果を丸める
        return Math.round(base + (q - threshold) * unit);
      }
      return base;
    }
    // 浮動小数点誤差を防ぐため、計算結果を丸める
    return Math.round(base + q * unit);
  }

  // kabiLineCategory: 見積行の大項目「そのほか」または「消毒」。
  // kabiProductData: 行に対応する productsData[大項目].カビ（未指定なら kabiLineCategory から解決）
  // 消毒行: co-occur 次は discountPrice（例 1000）を用い、基礎/MJ60+SO2 向け 1700 階段は使わない
  function calculateKabiPrice(quantity, selectedProductsContext, productsData, kabiLineCategory, kabiProductData) {
    var q = toNumber(quantity, 0);
    if (q <= 0) return 0;
    var kabiData = kabiProductData;
    if (!kabiData && productsData && (kabiLineCategory === 'そのほか' || kabiLineCategory === '消毒')) {
      var c = productsData[kabiLineCategory];
      if (c && c['カビ']) kabiData = c['カビ'];
    }

    // コアルール（商品名対商品名）の単価上書きを適用
    try {
      if (global.CoreRules && typeof global.CoreRules.getUnitOverride === 'function' &&
          (kabiLineCategory === 'そのほか' || kabiLineCategory === '消毒')) {
        var override = global.CoreRules.getUnitOverride(
          kabiLineCategory, 'カビ', selectedProductsContext || []);
        if (isFinite(override) && Number(override) > 0) {
          return Number(override) * q;
        }
      }
    } catch (_) {}
    
    // 消毒/カビ: 商品定義の discountPrice を優先（他区分のカビ 1700 階段で上書きしない）
    if (kabiLineCategory === '消毒') {
      var uSho = kabiData ? toNumber(kabiData.discountPrice, 0) : 0;
      if (!isFinite(uSho) || uSho <= 0) uSho = 1000;
      return uSho * q;
    }
    
    // フォールバック: そのほか/カビ — 従来のロジック
    var unit = 2500;
    
    // 基礎がある場合は1700円
    var hasKiso = selectedProductsContext.some(function (p) {
      return p.category === '基礎';
    });
    
    // MJ60系とSO2系が同時に選択された場合のみ1700円
    var hasMJ60 = selectedProductsContext.some(function (p) {
      return includesAny(p.item, ['MJ60買', 'MJ60新']);
    });
    var hasSO2 = selectedProductsContext.some(function (p) {
      return includesAny(p.item, ['SO2買', 'SO2新', 'SO260買', 'SO260新', 'SO2(DC2)買', 'SO2(DC2)新']);
    });
    
    // 条件判定
    if (hasKiso) {
      // 基礎がある場合は1700円
      unit = 1700;
    } else if (hasMJ60 && hasSO2) {
      // MJ60系とSO2系が同時に選択された場合のみ1700円
      unit = 1700;
    }
    // どちらもない場合は2500円（デフォルト）
    
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
    // まずはコアルール（商品名対商品名）の単価上書きを優先
    try {
      if (global.CoreRules && typeof global.CoreRules.getUnitOverride === 'function') {
        var override = global.CoreRules.getUnitOverride('床下機器', 'SO2買', selectedProductsContext || []);
        if (isFinite(override) && Number(override) > 0) {
          return Number(override) * q;
        }
      }
    } catch (_) {}
    // フォールバック: DC2 が選択に含まれると 83,000、単体は 88,000（productData.price 優先）
    var hasDC2 = (selectedProductsContext || []).some(function (p) { return includesAny(p.item, ['DC2']); });
    var unit = hasDC2 ? 83000 : toNumber(productData && productData.price, 88000);
    return unit * q;
  }

  function calculateKisoPrice(category, item, height, length, discountValue, kisoProductsData) {
    if (!kisoProductsData || !kisoProductsData[category] || !kisoProductsData[category][item]) {
      return { ex: 0, inTax: 0 };
    }
    var productData = kisoProductsData[category][item];
    var heights = productData['高さ別価格'] || {};
    
    // 高さのヒットロジック: 完全一致 → 入力値以上の最小高さクラス（45cmなら50cm）
    var hData = heights[String(height)] || heights[height];
    var selectedHeight = hData ? toNumber(height, 0) : 0;
    if (!hData) {
      // 完全一致しない場合、切り上げで該当する高さを探す
      var heightNum = toNumber(height, 0);
      var availableHeights = Object.keys(heights).map(function(h) { return toNumber(h, 0); }).sort(function(a, b) { return a - b; });

      for (var i = 0; i < availableHeights.length; i++) {
        var rangeHeight = availableHeights[i];
        if (heightNum <= rangeHeight) {
          selectedHeight = rangeHeight;
          hData = heights[String(rangeHeight)];
          break;
        }
      }

      // 最大高さを超える場合は最大クラスを適用
      if (!hData && availableHeights.length > 0) {
        selectedHeight = availableHeights[availableHeights.length - 1];
        hData = heights[String(selectedHeight)];
      }
    }
    
    if (!hData) return { ex: 0, inTax: 0 };
    var base = toNumber(hData['基本価格'], 0);
    var perLen = toNumber(hData['長さ加算'], 0);
    
    // 高さごとの基本長さを優先、なければ商品全体の基本長さを使用
    var basicLen = toNumber(hData['基本長さ'], 0);
    if (!isFinite(basicLen) || basicLen === 0) {
      basicLen = toNumber(productData['基本長さ'], 0);
    }
    
    // Firestoreなどで基本長さが未設定の場合のフォールバック
    if (!isFinite(basicLen) || basicLen === 0) {
      if (String(category) === 'クラック') {
        basicLen = 1;
      } else if (String(item) === '中基礎') {
        // 中基礎の高さごとの基本長さ
        if (selectedHeight === 30) {
          basicLen = 20; // 30cmは20m
        } else {
          basicLen = 10; // その他の高さは10m
        }
      } else {
        basicLen = 20; // その他の基礎商品
      }
    }
    var len = toNumber(length, 0);

    var exTax = base;
    if (len > basicLen) {
      // 浮動小数点誤差を防ぐため、計算結果を丸める
      exTax = Math.round(exTax + (len - basicLen) * perLen);
    }

    var discount = calculateDiscount(exTax, discountValue);
    var ex = Math.ceil(Math.max(0, exTax - discount));
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
      exTax = calculateKabiPrice(quantity, selectedProductsContext, productsData, category, productData);
    } else if (category === '床下機器' && item === 'SO2買') {
      exTax = calculateSO2BuyPrice(quantity, selectedProductsContext, productData);
    } else {
      exTax = calculateNormalProductPrice(productData, quantity, category, item, selectedProductsContext);
    }

    var discount = calculateDiscount(exTax, discountValue);
    var ex = Math.ceil(Math.max(0, exTax - discount));
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
