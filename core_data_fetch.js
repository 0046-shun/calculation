// Feature-flagged data loader (UMD). Default: use data.js globals.
(function (global) {
  'use strict';

  // Feature flag is read dynamically inside loadData()

  function ensureNormalizedCaches() {
    if (!global.CoreData) return;
    global.normalizedGoods = global.CoreData.normalizeGoods(global.goodsData || {});
    global.normalizedKiso = global.CoreData.normalizeKiso(global.kisoProductsData || {});
  }

  function setFromDataJs() {
    // data.js already populated window.goodsData/window.kisoProductsData
    ensureNormalizedCaches();
    return Promise.resolve({ source: 'datajs', goods: global.goodsData, kiso: global.kisoProductsData });
  }

  function firestoreInit() {
    if (!global.firebase || !global.firebase.initializeApp) {
      return Promise.reject(new Error('Firebase SDK not loaded'));
    }
    try {
      if (!global.firebase.apps || !global.firebase.apps.length) {
        // Placeholder config (to be replaced when wiring real project)
        var cfg = global.FIREBASE_CONFIG || {};
        global.firebase.initializeApp(cfg);
      }
      // Improve connectivity behind proxies/firewalls
      try {
        if (!global.__FIRESTORE_SETTINGS_APPLIED__) {
          var dbForSettings = global.firebase.firestore();
          if (dbForSettings && dbForSettings.settings) {
            dbForSettings.settings({ experimentalForceLongPolling: true, useFetchStreams: false });
            global.__FIRESTORE_SETTINGS_APPLIED__ = true;
          }
        }
      } catch (e) {
        // ignore settings errors
      }
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function fetchFirestoreProducts() {
    var db = global.firebase.firestore();
    return db.collection('products').where('status', '==', 'published').get().then(function (snap) {
      var goods = {};
      var kiso = {};
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        if (d.pricingByHeight) {
          // Kiso-style
          kiso[d.category] = kiso[d.category] || {};
          var byH = {};
          Object.keys(d.pricingByHeight || {}).forEach(function (h) {
            var v = d.pricingByHeight[h] || {};
            byH[h] = { '基本価格': v.basicPrice || 0, '長さ加算': v.lengthUnitPrice || 0 };
          });
          kiso[d.category][d.itemName] = { '高さ別価格': byH, '基本長さ': (d.pricingByHeight['30'] && d.pricingByHeight['30'].basicLength) || 20 };
        } else {
          // Goods-style
          goods[d.category] = goods[d.category] || {};
          goods[d.category][d.itemName] = {
            base: d.pricing && d.pricing.base || 0,
            price: d.pricing && d.pricing.unitPrice || 0,
            areaThreshold: d.pricing && d.pricing.basicQty || undefined
          };
        }
      });
      global.goodsData = goods;
      global.kisoProductsData = kiso;
      ensureNormalizedCaches();
      return { source: 'firestore', goods: goods, kiso: kiso };
    });
  }

  function loadData() {
    var useFirestore = !!global.FEATURE_USE_FIRESTORE;
    if (!useFirestore) {
      return setFromDataJs();
    }
    return firestoreInit().then(fetchFirestoreProducts).catch(function (err) {
      console.warn('Firestore fetch failed, fallback to data.js:', err);
      return setFromDataJs();
    });
  }

  global.CoreDataFetch = { loadData: loadData };
})(window);


