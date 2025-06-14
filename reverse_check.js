// data.jsのデータ構造に依存します。ここでは仮にwindow.goodsDataとして商品リストがあると仮定します。

// 一般管理費（管有）の金額
const MANAGEMENT_FEE = 20000;
// ALIAS_MAPは使わない

// 文字列をnormalize（前後スペース除去・全角→半角・小文字化）
function normalize(str) {
    return str.trim().replace(/[\uFF01-\uFF5E]/g, function(ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).toLowerCase();
}

// カテゴリーごとの商品名をフラットなリストに変換
function getAllGoodsList(goodsData) {
    const list = [];
    for (const category in goodsData) {
        for (const item in goodsData[category]) {
            list.push({
                category,
                item,
                data: goodsData[category][item]
            });
        }
    }
    return list;
}

// --- script.jsの計算ロジックを移植 ---
function calculateKabiPrice(quantity, selectedProducts) {
    const kabiData = window.goodsData["そのほか"]["カビ"];
    let appliedPrice = kabiData.price;
    for (const product of selectedProducts) {
        if (product.category === "消毒") {
            appliedPrice = kabiData.discountPrice;
            break;
        }
        if (product.category === "床下機器" && (product.item.includes("DC2") || product.item.includes("60"))) {
            appliedPrice = kabiData.discount2Price;
            break;
        }
    }
    return appliedPrice * quantity;
}

function calculateBMPrice(quantity, selectedProducts) {
    const bmData = window.goodsData["そのほか"]["BM"];
    let appliedPrice = bmData.price;
    const hasExistingDiscount = selectedProducts.some(product => {
        if (bmData.discountConditions.some(condition =>
            condition.type === "category" && condition.value === product.category)) {
            return true;
        }
        if (bmData.discountConditions.some(condition =>
            condition.type === "item" && condition.value === product.item)) {
            return true;
        }
        return false;
    });
    const hasKiso = selectedProducts.some(product =>
        (product.item && (product.item.includes("外基礎") || product.item.includes("中基礎")))
    );
    if (hasExistingDiscount || hasKiso) {
        appliedPrice = bmData.discountPrice;
    }
    return appliedPrice * quantity;
}

function calculateDiscount(price, discountValue) {
    if (!discountValue || discountValue <= 0) return 0;
    if (discountValue < 100) {
        return Math.floor(price * (discountValue / 100));
    }
    return Math.min(discountValue, price);
}
// --- ここまでscript.jsロジック ---

function parseDiscountFromName(name) {
    // ▲5％ or ▲5% → 5%割引, ▲1000円 → 1000円割引, ▲JA → 10%割引
    if (name.includes('▲JA')) return 10;
    const percentMatch = name.match(/▲([0-9]+(?:\.[0-9]+)?)\s*[%％]/);
    if (percentMatch) {
        return parseFloat(percentMatch[1]);
    }
    const yenMatch = name.match(/▲([0-9,]+)\s*円?/);
    if (yenMatch) {
        return parseInt(yenMatch[1].replace(/,/g, ''), 10);
    }
    return 0;
}

function removeDiscountFromName(name) {
    return name.replace(/▲JA/, '').replace(/▲[0-9]+(?:\.[0-9]+)?\s*[%％]/, '').replace(/▲[0-9,]+\s*円?/, '').trim();
}

function parseQuantity(qty) {
    // 108円や80％などを数値だけにする
    if (!qty) return 0;
    const match = qty.match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : 0;
}

function parseKisoQuantity(qty) {
    // 30*20 → {height: 30, length: 20}
    const match = qty.match(/([0-9]+)\*([0-9]+)/);
    if (match) {
        return { height: Number(match[1]), length: Number(match[2]) };
    }
    return { height: 0, length: 0 };
}

function getKisoCandidates() {
    // 新規工事・追加工事の全小項目をリストアップ
    const kisoData = window.kisoProductsData || {};
    let candidates = [];
    ["新規工事", "追加工事"].forEach(cat => {
        if (kisoData[cat]) {
            candidates = candidates.concat(Object.keys(kisoData[cat]));
        }
    });
    return candidates;
}

// 初回ペーストデータ保持用
if (!window.initialPasteData) window.initialPasteData = [];

// ペースト時に初期値を保存（値引きも含めて）
function saveInitialPasteData() {
    const lines = document.getElementById('input-area').value.trim().split(/\r?\n/);
    window.initialPasteData = lines.map(line => {
        const [name, qty, price] = line.split(/\t|\s{2,}/);
        const nameParts = name.split(/[・･]/);
        // 値引きもパース
        let discount = '';
        let qtyVal = qty;
        if (qty && /JA|▲|％|%|円/.test(qty)) {
            const m = qty.match(/(.+?)(JA|▲[\d,.]+|[\d,.]+％|[\d,.]+%|[\d,.]+円)?$/);
            if (m) {
                qtyVal = m[1].trim();
                discount = m[2] ? m[2].trim() : '';
            }
        }
        return nameParts.map((part, i) => ({
            name: part,
            qty: qty,
            price: price,
            discount: discount
        }));
    });
}

// チェックボタン押下時に初期値を保存し、テーブルも描画
const checkBtn = document.getElementById('check-button');
if (checkBtn) {
    checkBtn.addEventListener('click', function() {
        saveInitialPasteData();
        renderCheckTable();
    });
}

// クリアボタン押下時のみ初期値をリセットし、input-areaとresult-areaもクリア
const clearBtn = document.getElementById('clear-button');
if (clearBtn) {
    clearBtn.addEventListener('click', function() {
        window.initialPasteData = [];
        document.getElementById('input-area').value = '';
        document.getElementById('result-area').innerHTML = '';
    });
}

function renderCheckTable() {
    const input = document.getElementById('input-area').value.trim();
    const lines = input.split(/\r?\n/);
    const results = [];
    const goodsList = getAllGoodsList(window.goodsData);

    lines.forEach((line, lineIdx) => {
        const [name, qty, price] = line.split(/\t|\s{2,}/); // タブまたは複数スペース区切り
        if (!name || !qty || !price) return;

        const nameParts = name.split(/[・･]/);
        const qtyParts = qty.split('/').map(q => q.trim());
        let totalExTax = 0;
        let totalInTax = 0;
        let inputNames = [];
        let discounts = [];
        let systemNames = [];
        let systemQtys = [];
        let systemAmounts = [];
        let selectCandidates = [];
        let selectedProducts = [];
        let originalDiscounts = [];
        let originalQtys = [...qtyParts];

        nameParts.forEach((part, i) => {
            let trimmed = part.trim();
            if (!trimmed) return;
            // 値引きを抽出
            let discountValue = parseDiscountFromName(trimmed);
            let discountLabel = '';
            if (trimmed.includes('▲JA')) discountLabel = 'JA';
            else if (trimmed.match(/▲[0-9]+(?:\.[0-9]+)?\s*[%％]/)) discountLabel = trimmed.match(/▲([0-9]+(?:\.[0-9]+)?)\s*[%％]/)[1] + '%';
            else if (trimmed.match(/▲[0-9,]+\s*円?/)) discountLabel = trimmed.match(/▲([0-9,]+)\s*円?/)[1] + '円';
            discounts.push(discountLabel);
            originalDiscounts.push(trimmed.match(/▲JA|▲[0-9]+(?:\.[0-9]+)?\s*[%％]|▲[0-9,]+\s*円?/g)?.join('') || '');
            // 値引き表記を除去した商品名で検索
            let nameForSearch = removeDiscountFromName(trimmed);
            inputNames.push(nameForSearch);
            // 基礎商品判定
            let isKiso = false;
            let kisoCategory = '';
            let kisoCandidates = [];
            if (nameForSearch.match(/基礎|クラック/)) {
                isKiso = true;
                kisoCategory = nameForSearch.includes('追') ? '追加工事' : '新規工事';
                kisoCandidates = getKisoCandidates();
            }
            // 数量を割り当て
            let thisQty = 0;
            let kisoHeight = 0, kisoLength = 0;
            let kisoQtyRaw = qtyParts[i] !== undefined ? qtyParts[i] : qtyParts[0];
            if (isKiso && kisoQtyRaw && kisoQtyRaw.includes('*')) {
                const kisoQ = parseKisoQuantity(kisoQtyRaw);
                kisoHeight = kisoQ.height;
                kisoLength = kisoQ.length;
                thisQty = kisoLength;
            } else {
                thisQty = parseQuantity(kisoQtyRaw);
            }
            if (nameForSearch.includes('管有')) {
                systemNames.push('一般管理費');
                systemQtys.push('1');
                systemAmounts.push(MANAGEMENT_FEE);
                totalExTax += MANAGEMENT_FEE;
                selectCandidates.push([]);
                selectedProducts.push({category: '管理費', item: '一般管理費'});
                return;
            }
            // カテゴリー・小項目を特定
            let matched = null;
            let matchedKey = '';
            let matchedCategory = '';
            const normTrimmed = normalize(nameForSearch);
            for (const g of goodsList) {
                if (normalize(g.item) === normTrimmed) {
                    matched = g.data;
                    matchedKey = g.item;
                    matchedCategory = g.category;
                    break;
                }
            }
            let candidates = [];
            if (!matched) {
                if (isKiso) {
                    candidates = kisoCandidates;
                } else {
                    for (const g of goodsList) {
                        if (normalize(g.item).includes(normTrimmed) || normTrimmed.includes(normalize(g.item))) {
                            if (!candidates.includes(g.item)) candidates.push(g.item);
                        }
                    }
                }
            }
            let amount = 0;
            if (matched) {
                // script.jsのロジックで金額(税抜)を計算
                if (isKiso) {
                    // 基礎商品ロジック
                    const kisoData = window.kisoProductsData || {};
                    const kisoCatData = kisoData[kisoCategory] || {};
                    const kisoItemData = kisoCatData[nameForSearch] || {};
                    if (kisoItemData["高さ別価格"] && kisoItemData["高さ別価格"][kisoHeight]) {
                        const heightData = kisoItemData["高さ別価格"][kisoHeight];
                        let basePrice = heightData["基本価格"];
                        let lengthPrice = heightData["長さ加算"];
                        let totalPrice = basePrice;
                        const basicLength = kisoItemData["基本長さ"] || 20;
                        if (kisoLength > basicLength) {
                            const extraLength = kisoLength - basicLength;
                            totalPrice += extraLength * lengthPrice;
                        }
                        amount = totalPrice;
                        // 値引き適用
                        amount -= calculateDiscount(amount, discountValue);
                    }
                } else if ((matchedCategory === "そのほか" && matchedKey === "カビ") ||
                    (matchedCategory === "消毒" && matchedKey === "カビ消毒")) {
                    amount = calculateKabiPrice(thisQty, selectedProducts);
                    amount -= calculateDiscount(amount, discountValue);
                } else if (matchedCategory === "そのほか" && matchedKey === "BM") {
                    amount = calculateBMPrice(thisQty, selectedProducts);
                    amount -= calculateDiscount(amount, discountValue);
                } else if (matchedCategory === "床下機器" && matchedKey === "SO2買") {
                    const hasSpecialDiscount = selectedProducts.some(product =>
                        product.item && (product.item.includes("DC2") || product.item.includes("60"))
                    );
                    const unitPrice = hasSpecialDiscount ? 83000 : matched.price;
                    amount = unitPrice * thisQty;
                    amount -= calculateDiscount(amount, discountValue);
                } else {
                    let totalPrice = matched.base || 0;
                    if (matched.areaThreshold) {
                        if (thisQty > matched.areaThreshold) {
                            totalPrice += matched.price * (thisQty - matched.areaThreshold);
                        }
                    } else {
                        totalPrice += matched.price * thisQty;
                    }
                    amount = totalPrice;
                    amount -= calculateDiscount(amount, discountValue);
                }
                systemNames.push(matchedKey);
                systemQtys.push(isKiso && kisoQtyRaw ? kisoQtyRaw : thisQty);
                systemAmounts.push(amount);
                totalExTax += amount;
                selectCandidates.push([]);
                selectedProducts.push({category: matchedCategory, item: matchedKey});
            } else {
                systemNames.push('');
                systemQtys.push(isKiso && kisoQtyRaw ? kisoQtyRaw : thisQty);
                systemAmounts.push('');
                selectCandidates.push(candidates);
            }
        });
        totalInTax = Math.floor(totalExTax * 1.1);
        const pasted = Number(price.toString().replace(/[^\d.]/g, ''));
        const isMatch = (totalExTax !== null && pasted === totalExTax);
        // 表示用テーブル
        let table = `<table style=\"margin-bottom:8px; border-collapse:collapse; width:100%;\" border=\"1\" data-line=\"${lineIdx}\">`;
        table += '<tr><th>商品名</th><th>値引</th><th>システム商品名</th><th>数量</th><th>金額(税抜)</th></tr>';
        for (let i = 0; i < nameParts.length; i++) {
            let sysCell = '';
            // 初回ペースト値をhiddenで保持
            let initial = (window.initialPasteData[lineIdx] && window.initialPasteData[lineIdx][i]) || {};
            let discountDisplay = initial.discount || '';
            let discountHidden = discountDisplay ? `<input type=\"hidden\" class=\"discount-keep\" value=\"${discountDisplay}\" readonly>` : '';
            let qtyDisplay = initial.qty || '';
            let qtyHidden = qtyDisplay ? `<input type=\"hidden\" class=\"qty-keep\" value=\"${qtyDisplay}\" readonly>` : '';
            if (systemNames[i]) {
                sysCell = systemNames[i];
            } else if (selectCandidates[i] && selectCandidates[i].length > 0) {
                sysCell = `<select data-line='${lineIdx}' data-row='${i}'>`;
                sysCell += `<option value=''>商品名を選択</option>`;
                selectCandidates[i].forEach(c => {
                    sysCell += `<option value=\"${c}\">${c}</option>`;
                });
                sysCell += '</select>';
            } else {
                sysCell = `<input type='text' style='width:90%' placeholder='商品名を入力' data-line='${lineIdx}' data-row='${i}' />`;
            }
            table += `<tr><td>${inputNames[i]}</td><td>${discountDisplay}${discountHidden}</td><td>${sysCell}</td><td>${qtyDisplay}${qtyHidden}</td><td>${systemAmounts[i]}</td></tr>`;
        }
        table += `<tr><td colspan='5'>税抜き合計: ${totalExTax.toLocaleString()} / 税込み合計: ${totalInTax.toLocaleString()}</td></tr>`;
        table += `<tr><td colspan='5'>貼付金額: ${pasted.toLocaleString()} / システム計算: ${totalExTax.toLocaleString()} <span class='${isMatch ? 'true' : 'false'}'>${isMatch}</span></td></tr>`;
        table += '</table>';
        results.push(table);
    });

    document.getElementById('result-area').innerHTML = results.join('');

    // テーブル内inputのイベント
    document.querySelectorAll('#result-area input[type="text"]').forEach(input => {
        input.addEventListener('change', function() {
            // input-areaは書き換えず、テーブルのみ再描画
            renderCheckTable();
        });
    });

    // テーブル内selectのイベント
    document.querySelectorAll('#result-area select').forEach(select => {
        select.addEventListener('change', function() {
            // input-areaは書き換えず、テーブルのみ再描画
            renderCheckTable();
        });
    });
} 