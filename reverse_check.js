(function (global) {
  var OUTPUT_STYLE = 'table'; // 'legacy' | 'table'
  function toHalfWidthDigits(s){
    return String(s||'').replace(/[０-９]/g, function(ch){ return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); });
  }

  function splitColumns(line){
    if (line.indexOf('\t') >= 0) return line.split(/\t/);
    if (line.indexOf(',') >= 0) return line.split(/,/);
    return line.trim().split(/\s+/); // フォールバック
  }

  // 値引き抽出/除去ユーティリティ
  function extractPercentDiscount(text){
    if (/▲\s*JA/i.test(text)) return 10; // JAは10%
    var m = text.match(/▲[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*[%％]/); // ▲(任意文字)5%
    return m ? Number(m[1]) : 0;
  }
  function extractYenDiscount(text){
    var m = text.match(/▲\s*([0-9,]+)\s*円/);
    return m ? Number(m[1].replace(/,/g,'')) : 0;
  }
  function stripDiscountMarkers(text){
    var s = String(text||'');
    s = s.replace(/\(外基礎・中基礎\)▲セット|（外基礎・中基礎）▲セット/g,'');
    s = s.replace(/▲\s*JA/gi,'');
    s = s.replace(/▲[^0-9]*[0-9]+(?:[.,][0-9]+)?\s*[%％]/g,''); // ▲東電5％ 等
    s = s.replace(/▲\s*[0-9,]+\s*円/g,'');
    return s.trim();
  }

  // 簡易正規化 & 候補生成
  function norm(s){ return String(s||'').toLowerCase().replace(/[\s、,()（）\-]/g,''); }
  function listAllItems(productsData){
    var arr = [];
    Object.keys(productsData||{}).forEach(function(cat){
      var items = productsData[cat]||{};
      Object.keys(items).forEach(function(it){ arr.push({category:cat, item:it, key: cat+'::'+it}); });
    });
    return arr;
  }
  function findCandidates(baseName, productsData, limit){
    var n = norm(baseName);
    var all = listAllItems(productsData);
    var scored = all.map(function(e){ var m = norm(e.item); var score = 0; if (m.indexOf(n)!==-1) score += 3; if (n.indexOf(m)!==-1) score += 2; score += Math.max(0, 1 - Math.abs(m.length - n.length)/20); return {e:e, s:score}; });
    scored.sort(function(a,b){ return b.s - a.s; });
    return scored.slice(0, limit||5).map(function(x){ return x.e; });
  }

  // 括弧グループの展開と修飾抽出
  function splitProductsWithParentheses(productsStr) {
    var products = [];
    var current = '';
    var parenCount = 0;
    for (var i = 0; i < productsStr.length; i++) {
      var ch = productsStr[i];
      if (ch === '(' || ch === '（') { parenCount++; current += ch; continue; }
      if (ch === ')' || ch === '）') { parenCount--; current += ch; continue; }
      if ((ch === '・' || ch === '･') && parenCount === 0) { if (current.trim()) { products.push(current.trim()); current=''; } continue; }
      current += ch;
    }
    if (current.trim()) products.push(current.trim());
    return products;
  }

  function parseGroupDiscount(name) {
    // (外基礎・中基礎)▲セット は展開せずフラグのみ
    var isExplicitKisoSet = (name.indexOf('外基礎') !== -1 && name.indexOf('中基礎') !== -1 && /▲\s*セット/.test(name));
    if (isExplicitKisoSet) {
      return { cleanedName: name, productsInGroup: [], isKisoSet: true };
    }
    var cleanedName = name;
    var all = [];
    for (var i=0;i<cleanedName.length;i++){
      if (cleanedName[i] === '(' || cleanedName[i] === '（'){
        var start=i, pc=1, j=i+1;
        while(j<cleanedName.length && pc>0){ var ch=cleanedName[j]; if(ch==='('||ch==='（') pc++; else if(ch===')'||ch==='）') pc--; j++; }
        if (pc===0){
          var end=j-1;
          var modStart=end+1, modEnd=modStart;
          while(modEnd<cleanedName.length){ var m=cleanedName.slice(modEnd).match(/^(新|買|▲[0-9]+(?:\.[0-9]+)?[%％]|▲[0-9,]+円?|▲JA)/); if(m){ modEnd+=m[0].length; } else { break; } }
          var inside=cleanedName.slice(start+1,end);
          var prods=splitProductsWithParentheses(inside);
          var modifiers=cleanedName.slice(modStart,modEnd).replace(/\s+/g,'');
          if (prods.length>=2){
            var repl=prods.map(function(p){ return p+modifiers; });
            all=all.concat(repl);
            cleanedName = cleanedName.slice(0,start)+repl.join('・')+cleanedName.slice(modEnd);
            i = start + repl.join('・').length - 1;
          } else {
            i = end;
          }
        } else { break; }
      }
    }
    return { cleanedName: cleanedName, productsInGroup: all, isKisoSet: false };
  }

  function parseLine(line) {
    // 期待形式: "商品名\t数量\t金額"（タブ/カンマ/空白も許容）
    var cols = splitColumns(line || '');
    var name = (cols[0] || '').trim().replace(/^"|"$/g,'');
    var qtyCol = toHalfWidthDigits(cols[1] || '');
    // 数量抽出: 「x/y/z」→ 各パートに左から対応させる。
    var qtySegs = (function(s){
      if (!s) return [];
      return s.split(/[\/・･]/).map(function(seg){ return seg.trim(); });
    })(qtyCol);
    var qtyParts = qtySegs.map(function(seg){ var m = seg.match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; });
    var aRaw = toHalfWidthDigits((cols[2] || '').replace(/[^\d]/g,''));
    return {
      name: name,
      qty: qtyParts.length ? (isFinite(qtyParts[0]) ? qtyParts[0] : 0) : 0,
      qtyParts: qtyParts,
      qtySegs: qtySegs,
      amount: Number(aRaw.replace(/[^\d]/g, '')) || 0
    };
  }

  function findProductByName(name, productsData) {
    // 完全一致優先でカテゴリーを横断検索
    var cats = Object.keys(productsData || {});
    for (var i = 0; i < cats.length; i++) {
      var c = cats[i];
      var items = productsData[c];
      if (!items) continue;
      if (Object.prototype.hasOwnProperty.call(items, name)) {
        return { category: c, item: name, data: items[name] };
      }
    }
        return null;
    }

  function calcExpected(row, ctx, productsData, kisoProductsData) {
    var name = row.name || '';
    // 固定額オプション（管有など商品マスタに無いもの）
    var standaloneFee = (global.FixedFees && global.FixedFees.findStandalone) ? global.FixedFees.findStandalone(name) : null;
    if (standaloneFee) {
      return { ex: standaloneFee.amount, inTax: Math.floor(standaloneFee.amount * 1.1) };
    }
    // 基礎/クラック判定
    var isKiso = /(外基礎|中基礎|クラック|外クラ|中片クラ|中両クラ)/.test(name);
    if (isKiso) {
      // カテゴリ推定
      var isCrack = /(クラック|外クラ|中片クラ|中両クラ)/.test(name);
      var category = isCrack ? 'クラック' : (name.indexOf('追') !== -1 ? '追加工事' : '新規工事');
      // 高さ*長さ or 個数
      var hm = name.match(/(\d+)\*(\d+(?:\.\d+)?)/);
      var height = hm ? hm[1] : '30';
      var length = hm ? Number(hm[2]) : Number(row.qty || 0);
      // 品目名抽出
      var item = '外基礎';
      if (name.indexOf('中基礎') !== -1) item = '中基礎';
      if (isCrack) {
        if (name.indexOf('外クラ') !== -1) item = '外クラ';
        else if (name.indexOf('中片クラ') !== -1) item = '中片クラ';
        else if (name.indexOf('中両クラ') !== -1) item = '中両クラ';
      }
      var resK = (global.CorePricing && global.CorePricing.calculateProductLine) ?
        global.CorePricing.calculateProductLine({ type:'kiso', category:category, item:item, height:height, length:length, discountValue:0, selectedProductsContext:ctx, productsData:productsData, kisoProductsData:kisoProductsData })
        : { ex:0, inTax:0 };
      return resK;
    }
    // 通常
    var p = findProductByName(name, productsData);
    if (!p) return { ex: 0, inTax: 0 };
    var res = (global.CorePricing && global.CorePricing.calculateProductLine) ?
      global.CorePricing.calculateProductLine({ type:'normal', category:p.category, item:p.item, quantity:row.qty, discountValue:0, selectedProductsContext:ctx, productsData:productsData, kisoProductsData:kisoProductsData })
      : { ex:0, inTax:0 };
    return res;
  }

  function buildContextFromRows(rows, productsData) {
    var ctx = [];
    rows.forEach(function (r) {
      var found = findProductByName(r.name, productsData);
      if (found) ctx.push({ category: found.category, item: found.item });
    });
    return ctx;
  }

  function formatYen(n) { return (Number(n)||0).toLocaleString() + '円'; }

  // 置換状態
  var rcReplacements = {}; // key: line-part -> itemName

  function renderLegacy(rows, results){
    var lines = [];
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      var e = results[i] || { ex:0 };
      var ok = (Number(r.amount)||0) === (Number(e.ex)||0);
      lines.push('商品名：' + r.name + '｜数量：' + r.qty + '｜入力：' + formatYen(r.amount) + '｜計算：' + formatYen(e.ex) + '｜' + (ok ? '一致' : '不一致'));
    }
    return '<pre style="white-space:pre-wrap;line-height:1.6">' + lines.join('\n') + '</pre>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var checkBtn = document.getElementById('check-button');
    if (checkBtn) {
      checkBtn.addEventListener('click', function () {
        var input = (document.getElementById('input-area').value || '');
        var lines = input ? input.split(/\r?\n/).filter(Boolean) : [];
        var rows = lines.map(parseLine);
        var productsData = global.productsData || global.goodsData || {};
        var kisoProductsData = global.kisoProductsData || {};
        var ctx = buildContextFromRows(rows, productsData);

        var html = '';
        rows.forEach(function(r, lineIndex){
          var g = parseGroupDiscount(r.name);
          // 置換済みの cleanedName を常に分割（括弧外の要素も落とさないため）
          var parts = g.cleanedName.split(/[・･]/);
          // 先に行内の文脈（カテゴリ/商品）を解決しておく（コア計算のルール適用用）
          var lineCtx = [];
          parts.forEach(function(pn){
            var nm = pn.trim(); if (!nm) return;
            var baseNm = nm.replace(/\(外基礎・中基礎\)▲セット|（外基礎・中基礎）▲セット|▲JA|▲[0-9.,]+\s*[%％円]?/g,'').trim();
            var isK = /(外基礎|中基礎|クラック|外クラ|中片クラ|中両クラ)/.test(nm);
            if (global.FixedFees && global.FixedFees.findStandalone && global.FixedFees.findStandalone(nm)) return; // 管理費等の固定額オプションは文脈から除外
            if (isK){
              var cat = /(クラック|外クラ|中片クラ|中両クラ)/.test(nm) ? 'クラック' : (nm.indexOf('追')!==-1 ? '追加工事' : '新規工事');
              var it = '外基礎';
              if (nm.indexOf('中基礎')!==-1) it='中基礎';
              if (cat==='クラック'){
                if(nm.indexOf('外クラ')!==-1) it='外クラ';
                else if(nm.indexOf('中片クラ')!==-1) it='中片クラ';
                else if(nm.indexOf('中両クラ')!==-1) it='中両クラ';
              }
              lineCtx.push({ category: cat, item: it });
            } else {
              var sys0 = findProductByName(baseNm, productsData);
              if (!sys0 && /追$/.test(baseNm)) { var alt0 = baseNm.replace(/追$/, '新'); sys0 = findProductByName(alt0, productsData); }
              if (sys0) lineCtx.push({ category: sys0.category, item: sys0.item });
            }
          });
          var details = [];
          var lineSum = 0;
          var hasOuter=false, hasInner=false;
          // 行内で基礎の高さを既定値として拾っておく（40*33 の 40 など）
          var defaultKisoHeight = (function(qsegs){
            for (var qi=0; qi<(qsegs||[]).length; qi++){
              var s = qsegs[qi]||'';
              var mh = s.match(/(\d+)\s*\*/);
              if (mh) return mh[1];
            }
            return null;
          })(r.qtySegs||[]);

          parts.forEach(function(pn, pi){
            var name = pn.trim(); if (!name) return;
            var discountLabel = '';
            if (/\(外基礎・中基礎\)▲セット|（外基礎・中基礎）▲セット/.test(name)) discountLabel = 'セット';
            // ▲東電5％ などのテキスト付き%割引は数値部分だけ抽出
            var perc = extractPercentDiscount(name);
            var yen  = extractYenDiscount(name);
            if (perc > 0)      discountLabel = perc + '%';
            else if (yen > 0)  discountLabel = yen + '円';
            else if (/▲JA/i.test(name)) discountLabel = '10%';
            // 値引き数値
            var discountValue = (function(n){
              var p = extractPercentDiscount(n); if (p > 0) return p; // %優先
              var y = extractYenDiscount(n);    if (y > 0) return y;
              return 0;
            })(name);

            var baseName = stripDiscountMarkers(name);
            // 置換があれば適用
            var repKey = lineIndex+':'+pi;
            if (rcReplacements[repKey]) baseName = rcReplacements[repKey];
            var sys = findProductByName(baseName, productsData);
            if (!sys && /追$/.test(baseName)) { var alt = baseName.replace(/追$/, '新'); sys = findProductByName(alt, productsData); if (sys) baseName = alt; }
            var isKiso = /(外基礎|中基礎|クラック|外クラ|中片クラ|中両クラ)/.test(name);
            var qtyParts = r.qtyParts || [];
            var qtySegs = r.qtySegs || [];
            var qtyPart = qtyParts[pi];
            var seg = qtySegs[pi] || '';
            var displayQty = '';
            var exVal = 0;

            var partFee = (global.FixedFees && global.FixedFees.findStandalone) ? global.FixedFees.findStandalone(name) : null;
            if (partFee) {
              sys = { category: partFee.category, item: partFee.label };
              displayQty = '';
              exVal = partFee.amount;
            } else if (/離島|島特/.test(baseName)) {
              // 離島関連は数量が記載されない → 1扱い
              var calcQtyIsl = isFinite(qtyPart) ? Number(qtyPart) : 1;
              if (!isFinite(qtyPart)) displayQty = '';
              else displayQty = String(calcQtyIsl);
              var targetIsl = sys || findProductByName(baseName, productsData);
              if (targetIsl){
                var resIsl = (global.CorePricing && global.CorePricing.calculateProductLine) ?
                  global.CorePricing.calculateProductLine({ type:'normal', category:targetIsl.category, item:targetIsl.item, quantity:calcQtyIsl, discountValue:discountValue, selectedProductsContext:lineCtx, productsData:productsData, kisoProductsData:kisoProductsData })
                  : { ex:0 };
                exVal = Number(resIsl.ex)||0;
                sys = { category:targetIsl.category, item:targetIsl.item };
              }
            } else if (isKiso) {
              var isCrack = /(クラック|外クラ|中片クラ|中両クラ)/.test(name);
              var category = isCrack ? 'クラック' : (name.indexOf('追') !== -1 ? '追加工事' : '新規工事');
              var item = '外基礎';
              if (name.indexOf('中基礎')!==-1) item='中基礎';
              if (isCrack){ if(name.indexOf('外クラ')!==-1) item='外クラ'; else if(name.indexOf('中片クラ')!==-1) item='中片クラ'; else if(name.indexOf('中両クラ')!==-1) item='中両クラ'; }
              // 数量セグメントから 高さ*長さ(または個数) を抽出
              var hlen = seg.match(/(\d+)\s*\*\s*(\d+(?:\.\d+)?)/);
              var height = null;
              var lengthOrCount = null;
              if (hlen) {
                height = hlen[1];
                // 単位記号 m 等は無視して数値化
                lengthOrCount = Number(String(hlen[2]).replace(/[^0-9.]/g,''));
                displayQty = hlen[1] + '*' + hlen[2];
                } else {
                if (isCrack) {
                  // クラック単品: "30*2" 形式 or 同時: "2" だけ → 高さは基礎から借用
                  var count = isFinite(qtyPart) ? Number(qtyPart) : 1;
                  lengthOrCount = count;
                  height = defaultKisoHeight || '30';
                  displayQty = height + '*' + String(count);
                } else {
                  // 基礎で高さ*長さが無い場合: 数値を長さとして扱い、高さは既定
                  height = (defaultKisoHeight || '30');
                  var len = isFinite(qtyPart) ? Number(qtyPart) : 0;
                  if (len === 0) {
                    // セグメントから長さだけの数値が拾える場合
                    var lm = seg.match(/\d+(?:\.\d+)?/);
                    if (lm) len = Number(lm[0]);
                  }
                  if (len === 0) len = 1;
                  lengthOrCount = len;
                  displayQty = height + '*' + String(len);
                }
              }
              var resK = (global.CorePricing && global.CorePricing.calculateProductLine) ?
                global.CorePricing.calculateProductLine({ type:'kiso', category:category, item:item, height:height, length:lengthOrCount, discountValue:discountValue, selectedProductsContext:lineCtx, productsData:productsData, kisoProductsData:kisoProductsData })
                : { ex:0 };
              exVal = Number(resK.ex)||0;
              
              // Firestore 側の品名が異なる場合のフォールバック処理
              if (exVal === 0 && global.CorePricing && global.CorePricing.calculateProductLine) {
                var altItem = null;
                var altCategory = category;
                
                if (category === '追加工事') {
                  // 追加工事では『外基礎追/中基礎追』の場合がある
                  altItem = item + '追';
                } else if (category === '新規工事' && item === '中基礎') {
                  // 新規工事の中基礎でヒットしない場合、追加工事の中基礎追を試す
                  altItem = item + '追';
                  altCategory = '追加工事';
                }
                
                if (altItem) {
                  var resAlt = global.CorePricing.calculateProductLine({ type:'kiso', category:altCategory, item:altItem, height:height, length:lengthOrCount, discountValue:discountValue, selectedProductsContext:lineCtx, productsData:productsData, kisoProductsData:kisoProductsData });
                  exVal = Number((resAlt||{}).ex) || 0;
                  if (exVal > 0) { 
                    item = altItem; 
                    category = altCategory;
                  }
                }
              }
              if (item==='外基礎') hasOuter=true; if(item==='中基礎') hasInner=true;
              sys = { category:category, item:item };
            } else {
              var calcQty = isFinite(qtyPart) ? Number(qtyPart) : 1; // 正常品は未指定なら1
              if (isFinite(qtyPart)) displayQty = String(calcQty); else displayQty = '';
              var target = sys || findProductByName(baseName, productsData);
              if (target){
                var resN = (global.CorePricing && global.CorePricing.calculateProductLine) ?
                  global.CorePricing.calculateProductLine({ type:'normal', category:target.category, item:target.item, quantity:calcQty, discountValue:discountValue, selectedProductsContext:lineCtx, productsData:productsData, kisoProductsData:kisoProductsData })
                  : { ex:0 };
                exVal = Number(resN.ex)||0;
                sys = { category:target.category, item:target.item };
              }
            }
            lineSum += exVal;
            // 商品名は値引き表記を除去して表示（システム名が取れればそれを優先）
            var displayName = (sys && sys.item) ? sys.item : baseName.replace(/\s+/g,' ');
            // 未ヒットなら候補セレクトを表示
            var sysCell = (sys && sys.item) ? (sys.item) : (function(){
              var cands = findCandidates(baseName, productsData, 6);
              var opts = '<option value="">候補を選択</option>' + cands.map(function(c){ return '<option value="'+c.item+'">'+c.item+'</option>'; }).join('');
              var selected = rcReplacements[repKey] ? String(rcReplacements[repKey]) : '';
              return '<select class="rc-cand" data-line="'+lineIndex+'" data-part="'+pi+'">'+opts.replace('value="'+selected+'"','value="'+selected+'" selected')+'</select>';
            })();
            details.push({ name:displayName, discount:discountLabel, sysNameHtml: sysCell, qty: displayQty, ex: exVal });
          });

          if (g.isKisoSet || (hasOuter && hasInner)) { lineSum -= 40000; }

          var pasted = Number(r.amount||0);
          var ok = Math.abs(pasted - lineSum) < 0.01; // 浮動小数点の精度問題を回避
          html += '<table class="' + (ok ? 'match-table' : 'mismatch-table') + '" data-line="' + lineIndex + '">';
          html += '<tr><th>商品名</th><th>値引き</th><th>システム商品名</th><th>数量</th><th>金額(税抜)</th></tr>';
          details.forEach(function(d){
            html += '<tr>' +
              '<td>' + d.name + '</td>' +
              '<td>' + (d.discount||'') + '</td>' +
              '<td>' + (d.sysNameHtml||'') + '</td>' +
              '<td>' + (d.qty===undefined?'':d.qty) + '</td>' +
              '<td>' + (d.ex? (Number(d.ex).toLocaleString()) : '') + '</td>' +
              '</tr>';
          });
          html += '<tr class="total-row ' + (ok?'match':'mismatch') + '"><td colspan="4">合計</td><td>' + (lineSum.toLocaleString()) + '</td></tr>';
          html += '<tr class="comparison-row ' + (ok?'match':'mismatch') + '"><td colspan="5">' +
                   '<div class="comparison-details">' +
                   '<span>貼付金額: ' + pasted.toLocaleString() + '</span>' +
                   '<span>計算金額(税抜): ' + lineSum.toLocaleString() + '</span>' +
                   '<span>計算金額(税込): ' + Math.round(lineSum * 1.1).toLocaleString() + '</span>' +
                   '<span class="difference">差額: ' + Math.round(pasted - lineSum).toLocaleString() + '</span>' +
                   '<span class="status">' + (ok ? '一致' : '不一致') + '</span>' +
                   '</div>' +
                   '</td></tr>';
          html += '</table>';
        });

        var result = document.getElementById('result-area');
        if (result) { result.innerHTML = html; }
        // 候補セレクトのイベントを束ねて設定
        Array.prototype.forEach.call(document.querySelectorAll('.rc-cand'), function(sel){
          sel.addEventListener('change', function(){
            var line = this.getAttribute('data-line');
            var part = this.getAttribute('data-part');
            var key = line+':'+part;
            var val = this.value;
            if (val) rcReplacements[key] = val; else delete rcReplacements[key];
            // 再実行
            checkBtn.click();
          });
        });
    });
}
    var clearBtn = document.getElementById('clear-button');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        var ta = document.getElementById('input-area');
        var ra = document.getElementById('result-area');
        if (ta) ta.value = '';
        if (ra) ra.textContent = '';
      });
    }
  });
})(window);
