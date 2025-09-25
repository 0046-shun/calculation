(function (global) {
  if (!global.CoreDataFetch) {
    global.CoreDataFetch = {};
  }

  function ensureFirebaseApp() {
    if (!global.firebase || !global.firebase.initializeApp) {
      throw new Error('Firebase SDK not loaded');
    }
    if (!global.firebase.apps || global.firebase.apps.length === 0) {
      global.firebase.initializeApp(global.FIREBASE_CONFIG || {});
    }
    return global.firebase.firestore();
  }

  function buildLocalFromFirestore(docs) {
    var localProducts = {};
    var localKiso = {};

    docs.forEach(function (doc) {
      var d = doc.data() || {};
      var category = d.category || '未分類';
      var itemName = d.itemName || ('item_' + doc.id);
      var sortIndex = (typeof d.sortIndex === 'number') ? d.sortIndex : null;

      // 通常商品の pricing
      if (d.pricing) {
        if (!localProducts[category]) localProducts[category] = {};
        localProducts[category][itemName] = {
          base: Number(d.pricing.base || 0),
          price: Number(d.pricing.unitPrice || 0),
          areaThreshold: Number(d.pricing.basicQty || 0),
          _sort: sortIndex
        };
      }

      // 基礎系の pricingByHeight
      if (d.pricingByHeight) {
        if (!localKiso[category]) localKiso[category] = {};
        var heightMap = {};
        var heights = Object.keys(d.pricingByHeight || {});
        heights.forEach(function (h) {
          var hConf = d.pricingByHeight[h] || {};
          heightMap[String(h)] = {
            '基本価格': Number(hConf.basicPrice || 0),
            '長さ加算': Number(hConf.lengthUnitPrice || 0),
            '基本長さ': Number(hConf.basicLength || 0) // 高さごとの基本長さを追加
          };
        });
        var basicLen = Number(d.basicLength || d.pricingByHeight.basicLength || 0);
        // 中基礎の基本長さを正しい値に設定（高さごとの設定がない場合のフォールバック）
        if (itemName === '中基礎' && basicLen === 0) {
          basicLen = 10; // 中基礎のデフォルト基本長さ
        }
        localKiso[category][itemName] = {
          '高さ別価格': heightMap,
          '基本長さ': basicLen,
          _sort: sortIndex
        };
      }
    });

    return { products: localProducts, kiso: localKiso };
  }

  global.CoreDataFetch.loadData = function () {
    return new Promise(function (resolve) {
      if (!global.FEATURE_USE_FIRESTORE) {
        resolve({ source: 'local', products: global.productsData, kiso: global.kisoProductsData });
        return;
      }
      try {
        var db = ensureFirebaseApp();
        console.log('Attempting to connect to Firestore...');
        db.collection('products').where('status', '==', 'published').get()
          .then(function (snap) {
            console.log('Firestore query successful, found', snap.size, 'documents');
            var built = buildLocalFromFirestore(snap.docs || []);
            // sortIndex マップも作成（カテゴリ→商品名→sortIndex）
            try {
              var siMap = {};
              (snap.docs || []).forEach(function(doc){
                var d = doc.data() || {};
                var c = d.category || '';
                var n = d.itemName || '';
                var si = (typeof d.sortIndex === 'number') ? d.sortIndex : null;
                if (!c || !n) return;
                if (!siMap[c]) siMap[c] = {};
                siMap[c][n] = si;
              });
              global.productsSortIndexMap = siMap;
            } catch(_) {}

            // 置き換え（空でなければ上書き）
            if (Object.keys(built.products).length > 0) {
              global.productsData = built.products;
              global.goodsData = built.products;
              console.log('Firestore products data loaded:', Object.keys(built.products).length, 'categories');
            }
            if (Object.keys(built.kiso).length > 0) {
              global.kisoProductsData = built.kiso;
              console.log('Firestore kiso data loaded:', Object.keys(built.kiso).length, 'categories');
              // 中基礎の価格データをログ出力
              if (built.kiso['新規工事'] && built.kiso['新規工事']['中基礎']) {
                console.log('中基礎 pricing data from Firestore:', built.kiso['新規工事']['中基礎']);
                console.log('中基礎 基本長さ:', built.kiso['新規工事']['中基礎']['基本長さ']);
              }
            }

            // UIを更新（関数がグローバル定義の場合）
            if (typeof global.loadProductData === 'function') {
              try { global.loadProductData(); } catch (_) {}
            }

            resolve({ source: 'firestore', count: snap.size });
          })
          .catch(function (err) {
            console.error('Firestore fetch failed, fallback to local:', err);
            console.log('Using local data instead');
            resolve({ source: 'fallback-local', products: global.productsData, kiso: global.kisoProductsData, error: String(err) });
          });
      } catch (e) {
        console.error('Firestore init failed, fallback to local:', e);
        console.log('Using local data instead');
        resolve({ source: 'fallback-local', products: global.productsData, kiso: global.kisoProductsData, error: String(e) });
      }
    });
  };
})(window);
