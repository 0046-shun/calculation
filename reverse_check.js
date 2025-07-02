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
    // (外基礎・中基礎)▲セット → 40,000円割引
    if (name.includes('(外基礎・中基礎)▲セット') || name.includes('（外基礎・中基礎）▲セット')) {
        console.log('基礎セット値引きを検出: 40,000円割引を適用');
        return 40000;
    }
    
    // ▲JA → 10%割引, ▲5％ or ▲5% → 5%割引, ▲1000円 → 1000円割引
    if (name.includes('▲JA')) {
        console.log('JA値引きを検出: 10%割引を適用');
        return 10;
    }
    const percentMatch = name.match(/▲([0-9]+(?:\.[0-9]+)?)\s*[%％]/);
    if (percentMatch) {
        const percent = parseFloat(percentMatch[1]);
        console.log(`${percent}%割引を検出`);
        return percent;
    }
    const yenMatch = name.match(/▲([0-9,]+)\s*円?/);
    if (yenMatch) {
        const yen = parseInt(yenMatch[1].replace(/,/g, ''), 10);
        console.log(`${yen}円割引を検出`);
        return yen;
    }
    return 0;
}

function removeDiscountFromName(name) {
    return name
        .replace(/\(外基礎・中基礎\)▲セット/, '')
        .replace(/（外基礎・中基礎）▲セット/, '')
        .replace(/▲JA/, '')
        .replace(/▲[0-9]+(?:\.[0-9]+)?\s*[%％]/, '')
        .replace(/▲[0-9,]+\s*円?/, '')
        .trim();
}

function parseQuantity(qty) {
    // 108円や80％などを数値だけにする
    if (!qty) return 0;
    const match = qty.match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : 0;
}

function parseKisoQuantity(qtyStr) {
    const [height, length] = qtyStr.split('*').map(n => parseInt(n.trim(), 10));
    return {
        height: normalizeKisoHeight(height || 0),
        length: length || 0
    };
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
        // 入力エリアもクリア
        document.getElementById('input-area').value = '';
        
        // clearAllInputs関数を呼び出し
        clearAllInputs();
    });
}

// グローバル変数の定義
let inputStates = {};
let searchName = '';  // searchNameをグローバル変数として定義

function calculateBasePrice(category, item, height, length) {
    console.log(`基礎価格計算開始: カテゴリ=${category}, 商品=${item}, 高さ=${height}, 長さ/個数=${length}`);
    
    if (!window.kisoProductsData || !window.kisoProductsData[category] || !window.kisoProductsData[category][item]) {
        console.log('基礎商品データが見つかりません');
        return 0;
    }

    const productData = window.kisoProductsData[category][item];
    if (!productData["高さ別価格"] || !productData["高さ別価格"][height]) {
        console.log('指定された高さの価格データが見つかりません');
        return 0;
    }

    const heightData = productData["高さ別価格"][height];
    let basePrice = heightData["基本価格"];
    let lengthPrice = heightData["長さ加算"];
    const basicLength = productData["基本長さ"] || 20;

    console.log(`基本価格: ${basePrice}, 長さ加算単価: ${lengthPrice}, 基本長さ: ${basicLength}`);

    if (category === "クラック") {
        // クラックの場合は個数で計算（長さ加算単価 × 個数）
        basePrice = lengthPrice * length;
        console.log(`クラック計算: ${lengthPrice} × ${length}個 = ${basePrice}`);
    } else {
        // 通常の基礎商品の場合
        if (length > basicLength) {
            const extraLength = length - basicLength;
            basePrice += extraLength * lengthPrice;
            console.log(`長さ加算: 基本長さ(${basicLength})を超える${extraLength}m分を加算`);
        }
    }

    // 基礎セット割引のチェック（クラック系は対象外）
    // 注意: この関数内では基礎セット割引を適用しない（renderCheckTableで一括処理）
    // 重複適用を防ぐため、ここでは割引を適用しない

    console.log(`最終計算金額: ${basePrice}`);
    return basePrice;
}

function parseBaseDimensions(inputName) {
    console.log(`基礎寸法の解析開始: "${inputName}"`);
    
    // 寸法情報を抽出（例: "30*20" の形式）
    const dimensions = inputName.match(/(\d+)\*(\d+)/);
    if (!dimensions) {
        console.log('寸法情報が見つかりません');
        return null;
    }

    const height = dimensions[1];
    const length = parseFloat(dimensions[2]);
    console.log(`抽出された寸法: 高さ=${height}cm, 長さ=${length}m`);

    return { height, length };
}

function renderCheckTable() {
    const inputArea = document.getElementById('input-area');
    const resultArea = document.getElementById('result-area');
    const lines = inputArea.value.split('\n').filter(line => line.trim());
    resultArea.innerHTML = '';

    console.log('=== テーブル描画開始 ===');
    console.log('入力行数:', lines.length);
    console.log('現在の入力状態:', inputStates);

    const goodsList = getAllGoodsList(window.goodsData);

    lines.forEach((line, lineIdx) => {
        const [name, qty, price] = line.split(/\t|\s{2,}/);
        if (!name || !qty || !price) return;

        // 行の状態を初期化（初回のみ）
        if (!inputStates[lineIdx]) {
            inputStates[lineIdx] = {
                originalName: name,
                originalQty: qty,
                originalPrice: price,
                parts: []
            };
        }

        console.log('商品名:', name);
        console.log('数量:', qty);
        console.log('金額:', price);

        // グループ値引きの処理
        const groupDiscountInfo = parseGroupDiscount(name);
        const hasGroupDiscount = groupDiscountInfo.groupDiscount !== null;
        let processedName = groupDiscountInfo.cleanedName;
        
        console.log('グループ値引き情報:', groupDiscountInfo);

        // 基礎セット値引きの特別処理
        let isKisoSetDiscount = false;
        let kisoSetDiscountAmount = 0;
        if (processedName.includes('(外基礎・中基礎)▲セット') || processedName.includes('（外基礎・中基礎）▲セット')) {
            isKisoSetDiscount = true;
            kisoSetDiscountAmount = 40000;
            console.log('基礎セット値引きを検出:', kisoSetDiscountAmount);
        }

        // 基礎セット値引きがある場合は特別な分割処理
        let nameParts;
        if (isKisoSetDiscount) {
            // (外基礎・中基礎)▲セット を一つの要素として扱い、他の商品と分離
            const kisoSetPattern = /\(外基礎・中基礎\)▲セット|（外基礎・中基礎）▲セット/;
            const kisoSetMatch = processedName.match(kisoSetPattern);
            if (kisoSetMatch) {
                const kisoSetPart = kisoSetMatch[0];
                const otherParts = processedName.replace(kisoSetPattern, '').split(/[・･]/).filter(part => part.trim());
                nameParts = [kisoSetPart, ...otherParts];
            } else {
                nameParts = processedName.split(/[・･]/);
            }
        } else if (hasGroupDiscount) {
            // グループ値引きがある場合は、グループ内の商品を個別に処理
            // ただし、グループ外の商品も含める必要がある
            const allParts = processedName.split(/[・･]/);
            const groupProducts = groupDiscountInfo.productsInGroup;
            const otherProducts = allParts.filter(part => 
                !groupProducts.some(groupProduct => part.trim() === groupProduct.trim())
            );
            // グループ括弧ごとの商品名（例：(SO2(DC2))）を除外
            const filteredOtherProducts = otherProducts.filter(part => {
                const trimmed = part.trim();
                // (xxx・yyy) のようなグループ括弧で囲まれたものは除外
                if (/^\(.+・.+\)$/.test(trimmed)) return false;
                return true;
            });
            // namePartsは展開済み商品名＋その他の商品名
            nameParts = [...groupProducts, ...filteredOtherProducts.filter(part => part.trim())];
            // 展開済み商品名の値引き情報も同じ内容で格納
            discounts = groupProducts.map(gp => {
                // 商品名から「新」「買」「▲○％」「▲○円」「▲JA」などの修飾語部分を抽出
                const mods = gp.match(/(新|買|▲[0-9]+(?:\.[0-9]+)?[%％]?|▲[0-9,]+円?|▲JA)+/g);
                return mods ? mods.join('') : '';
            });
            // その他の商品名の値引き情報も追加
            discounts = [...discounts, ...filteredOtherProducts.map(() => '')];
            console.log('グループ値引き商品分割:', { groupProducts, filteredOtherProducts, nameParts, discounts });
        } else {
            nameParts = processedName.split(/[・･]/);
        }

        // ★ここから外基礎・中基礎＋▲セット/セットの正規化処理（全partに適用）
        nameParts = nameParts.map(part => {
            if (part.match(/外基礎|中基礎/)) {
                return part.replace(/[\(\)（）]/g, '')
                           .replace(/▲セット|▲ｾｯﾄ|セット|ｾｯﾄ/g, '')
                           .trim();
            }
            return part;
        });

        // ★ここから外基礎・中基礎＋▲セット/セットの特別処理
        let isKisoSetLine = false;
        if (nameParts.length === 1 && (nameParts[0].includes('外基礎') || nameParts[0].includes('中基礎')) && (nameParts[0].includes('▲セット') || nameParts[0].includes('セット'))) {
            // 1行で括弧付きや▲セット付きの場合
            nameParts = nameParts[0]
                .replace(/[\(（]?外基礎[\)）]?/g, '外基礎')
                .replace(/[\(（]?中基礎[\)）]?/g, '中基礎')
                .replace(/▲セット|セット/g, '')
                .split(/[・･]/)
                .map(part => part.trim())
                .filter(Boolean);
            isKisoSetLine = true;
        }

        // 数量の区切りを「/」「・」「･」すべて対応
        const qtyParts = qty.split(/[\/・･]/).map(q => q.trim());
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

        // 基礎セット値引きのチェック用変数
        let hasGaiKiso = false;
        let hasNakaKiso = false;
        let gaiKisoAmount = 0;
        let nakaKisoAmount = 0;
        let gaiKisoPartIdx = -1;
        let nakaKisoPartIdx = -1;

        nameParts.forEach((part, partIdx) => {
            // パートの状態を初期化（初回のみ）
            if (!inputStates[lineIdx].parts[partIdx]) {
                inputStates[lineIdx].parts[partIdx] = {
                    inputValue: '',
                    selectedValue: ''
                };
            }

            let trimmed = part.trim();
            if (!trimmed) return;

            // 「再▲○○％」や「▲○○％」の正規化（JA以外）
            // 例: 再▲神社仏閣10％ → 再▲10％、▲縁者5％ → ▲5％
            trimmed = trimmed.replace(/(再)?▲(?!JA)([^\d]*)([\d,.]+\s*[％%円])/g, (match, sai, notJA, percent) => {
                return (sai ? '再▲' : '▲') + percent.trim();
            });

            // 入力値または選択値がある場合はそれを使用
            const currentState = inputStates[lineIdx].parts[partIdx];
            let searchName = trimmed;
            if (currentState.inputValue) {
                searchName = currentState.inputValue;
                console.log('入力値を使用:', searchName);
            } else if (currentState.selectedValue) {
                searchName = currentState.selectedValue;
                console.log('選択値を使用:', searchName);
            }

            // 値引きを抽出
            let discountValue = parseDiscountFromName(searchName);
            
            // グループ値引きがある場合は適用
            if (hasGroupDiscount && groupDiscountInfo.productsInGroup.includes(trimmed)) {
                if (groupDiscountInfo.groupDiscount.type === 'percent') {
                    discountValue = groupDiscountInfo.groupDiscount.value;
                } else if (groupDiscountInfo.groupDiscount.type === 'yen') {
                    discountValue = groupDiscountInfo.groupDiscount.value;
                }
                console.log('グループ値引きを適用:', { product: trimmed, discount: discountValue });
            }
            
            // ★値引欄の特別処理
            let discountLabel = '';
            if (part === '外基礎' || part === '中基礎') {
                discountLabel = 'セット';
            } else if (isKisoSetLine && (part === '外基礎' || part === '中基礎')) {
                discountLabel = 'セット';
            } else if (searchName.includes('(外基礎・中基礎)▲セット') || searchName.includes('（外基礎・中基礎）▲セット')) {
                discountLabel = 'セット';
            } else if (hasGroupDiscount && groupDiscountInfo.productsInGroup.includes(trimmed)) {
                if (groupDiscountInfo.groupDiscount.type === 'percent') {
                    discountLabel = groupDiscountInfo.groupDiscount.value + '%';
                } else if (groupDiscountInfo.groupDiscount.type === 'yen') {
                    discountLabel = formatNumber(groupDiscountInfo.groupDiscount.value) + '円';
                }
            } else if (searchName.includes('▲JA')) {
                discountLabel = 'JA';
            } else if (searchName.match(/▲[0-9]+(?:\.[0-9]+)?\s*[%％]/)) {
                discountLabel = searchName.match(/▲([0-9]+(?:\.[0-9]+)?)\s*[%％]/)[1] + '%';
            } else if (searchName.match(/▲[0-9,]+\s*円?/)) {
                discountLabel = searchName.match(/▲([0-9,]+)\s*円?/)[1] + '円';
            }
            console.log('値引き情報:', { discountValue, discountLabel });

            discounts.push(discountLabel);
            originalDiscounts.push(searchName.match(/▲JA|▲[0-9]+(?:\.[0-9]+)?\s*[%％]|▲[0-9,]+\s*円?|\(外基礎・中基礎\)▲セット|（外基礎・中基礎）▲セット/g)?.join('') || '');

            // 値引き表記を除去した商品名で検索
            let nameForSearch = removeDiscountFromName(searchName);
            // 末尾が「追」の場合は「新」に変換
            nameForSearch = nameForSearch.replace(/追$/, '新');
            // BMで始まる場合はBMに正規化
            nameForSearch = nameForSearch.replace(/^BM.*/, 'BM');
            inputNames.push(nameForSearch);
            console.log('検索用商品名:', nameForSearch);

            // 基礎セット値引きの場合は特別処理
            if (searchName.includes('(外基礎・中基礎)▲セット') || searchName.includes('（外基礎・中基礎）▲セット')) {
                // 外基礎と中基礎の2つの商品として処理
                const kisoProducts = ['外基礎', '中基礎'];
                let kisoTotalAmount = 0;
                
                kisoProducts.forEach((kisoItem, kisoIdx) => {
                    // 数量を取得（基礎商品の高さ・長さ）
                    let kisoHeight = 0, kisoLength = 0;
                    let kisoQtyRaw = qtyParts[partIdx + kisoIdx] !== undefined ? qtyParts[partIdx + kisoIdx] : qtyParts[0];
                    if (kisoQtyRaw && kisoQtyRaw.includes('*')) {
                        const kisoQ = parseKisoQuantity(kisoQtyRaw);
                        kisoHeight = kisoQ.height;
                        kisoLength = kisoQ.length;
                    }
                    
                    // 基礎商品の価格計算
                    const kisoAmount = calculateBasePrice('新規工事', kisoItem, kisoHeight, kisoLength);
                    kisoTotalAmount += kisoAmount;
                    
                    systemNames.push(kisoItem);
                    systemQtys.push(kisoQtyRaw || '');
                    systemAmounts.push(kisoAmount);
                    selectedProducts.push({category: '新規工事', item: kisoItem});
                });
                
                // セット値引きを適用
                kisoTotalAmount -= kisoSetDiscountAmount;
                totalExTax += kisoTotalAmount;
                selectCandidates.push([]);
                
                console.log('基礎セット処理完了:', { totalAmount: kisoTotalAmount, discount: kisoSetDiscountAmount });
                return;
            }

            // 基礎商品判定
            let isKiso = false;
            let kisoCategory = '';
            let kisoCandidates = [];
            if (nameForSearch.match(/基礎|クラック/)) {
                isKiso = true;
                if (nameForSearch.includes('クラック')) {
                    kisoCategory = 'クラック';
                } else {
                    kisoCategory = nameForSearch.includes('追') ? '追加工事' : '新規工事';
                }
                kisoCandidates = getKisoCandidates(kisoCategory);
                console.log('基礎商品判定:', { isKiso, kisoCategory, candidates: kisoCandidates });
                
                // 外基礎・中基礎の判定と記録
                if (kisoCategory === '新規工事') {
                    if (nameForSearch.includes('外基礎')) {
                        hasGaiKiso = true;
                        gaiKisoPartIdx = partIdx;
                    } else if (nameForSearch.includes('中基礎')) {
                        hasNakaKiso = true;
                        nakaKisoPartIdx = partIdx;
                    }
                }
            }

            // 数量を割り当て（基礎商品・クラック系の高さ・長さを先に取得）
            let thisQty = 0;
            let kisoHeight = 0, kisoLength = 0;
            let kisoQtyRaw = qtyParts[partIdx] !== undefined ? qtyParts[partIdx] : qtyParts[0];
            if (isKiso && kisoQtyRaw && kisoQtyRaw.includes('*')) {
                const kisoQ = parseKisoQuantity(kisoQtyRaw);
                kisoHeight = kisoQ.height;
                kisoLength = kisoQ.length;
                
                if (kisoCategory === 'クラック') {
                    // クラック系の場合：高さ*個数 → 個数を数量として使用
                    thisQty = kisoLength;
                    console.log('クラック数量:', { height: kisoHeight, count: kisoLength, qty: thisQty });
                } else {
                    // 基礎工事の場合：高さ*長さ → 長さを数量として使用
                    thisQty = kisoLength;
                    console.log('基礎工事数量:', { height: kisoHeight, length: kisoLength, qty: thisQty });
                }
            } else {
                thisQty = parseQuantity(kisoQtyRaw);
                console.log('通常数量:', thisQty);
            }

            if (nameForSearch.includes('管有')) {
                systemNames.push('一般管理費');
                systemQtys.push('');
                systemAmounts.push(MANAGEMENT_FEE);
                totalExTax += MANAGEMENT_FEE;
                selectCandidates.push([]);
                selectedProducts.push({category: '管理費', item: '一般管理費'});
                console.log('管有商品処理完了');
                return;
            }

            // 元の商品名でも管有をチェック（グループ値引きの場合に対応）
            if (trimmed.includes('管有')) {
                systemNames.push('一般管理費');
                systemQtys.push('');
                systemAmounts.push(MANAGEMENT_FEE);
                totalExTax += MANAGEMENT_FEE;
                selectCandidates.push([]);
                selectedProducts.push({category: '管理費', item: '一般管理費'});
                console.log('管有商品処理完了（元の商品名から検出）');
                return;
            }

            // カテゴリー・小項目を特定
            let matched = null;
            let matchedKey = '';
            let matchedCategory = '';
            const normTrimmed = normalize(nameForSearch);
            console.log('正規化された商品名:', normTrimmed);

            // 基礎商品の場合は直接kisoProductsDataから検索
            if (isKiso) {
                const kisoData = window.kisoProductsData || {};
                let kisoCatData;
                
                if (kisoCategory === 'クラック') {
                    kisoCatData = kisoData['クラック'] || {};
                } else {
                    kisoCatData = kisoData[kisoCategory] || {};
                }
                
                // 「外基礎追」→「外基礎」、「外基礎」→「外基礎」のように商品名を特定
                let cleanItemName = nameForSearch.replace('追', '');
                
                if (kisoCatData[cleanItemName]) {
                    matched = kisoCatData[cleanItemName];
                    matchedKey = cleanItemName;
                    matchedCategory = kisoCategory;
                    console.log('基礎商品一致:', { key: matchedKey, category: matchedCategory });
                }
            } else {
                // 通常商品の完全一致検索
                for (const g of goodsList) {
                    if (normalize(g.item) === normTrimmed) {
                        matched = g.data;
                        matchedKey = g.item;
                        matchedCategory = g.category;
                        console.log('完全一致商品:', { key: matchedKey, category: matchedCategory });
                        break;
                    }
                }
            }

            // 完全一致がなければ部分一致候補を取得
            let candidates = [];
            if (!matched) {
                if (isKiso) {
                    candidates = kisoCandidates;
                } else {
                    candidates = findPartialMatches(nameForSearch);
                }
                // 部分一致候補が1件のみなら自動選択
                if (candidates.length === 1) {
                    const autoMatch = candidates[0];
                    // goodsData/kisoProductsDataからカテゴリ特定
                    let found = false;
                    for (const [cat, items] of Object.entries(window.goodsData || {})) {
                        if (items[autoMatch]) {
                            matched = items[autoMatch];
                            matchedKey = autoMatch;
                            matchedCategory = cat;
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        for (const [cat, items] of Object.entries(window.kisoProductsData || {})) {
                            if (items[autoMatch]) {
                                matched = items[autoMatch];
                                matchedKey = autoMatch;
                                matchedCategory = cat;
                                break;
                            }
                        }
                    }
                }
            }

            let amount = 0;
            if (matched) {
                // 金額計算ロジック
                if (isKiso) {
                    if (kisoCategory === 'クラック') {
                        // クラック系の計算：高さ*個数で計算
                        amount = calculateBasePrice('クラック', matchedKey, kisoHeight, kisoLength);
                        amount -= calculateDiscount(amount, discountValue);
                        console.log('クラック計算結果:', { 
                            category: 'クラック', 
                            item: matchedKey, 
                            height: kisoHeight, 
                            count: kisoLength, 
                            baseAmount: amount + calculateDiscount(amount, discountValue), 
                            discount: calculateDiscount(amount, discountValue), 
                            finalAmount: amount 
                        });
                    } else {
                        // 基礎商品の計算（kisoHeight, kisoLengthが定義済み）
                        amount = calculateBasePrice(matchedCategory, matchedKey, kisoHeight, kisoLength);
                        amount -= calculateDiscount(amount, discountValue);
                        console.log('基礎商品計算結果:', { 
                            category: matchedCategory, 
                            item: matchedKey, 
                            height: kisoHeight, 
                            length: kisoLength, 
                            baseAmount: amount + calculateDiscount(amount, discountValue), 
                            discount: calculateDiscount(amount, discountValue), 
                            finalAmount: amount 
                        });
                        
                        // 外基礎・中基礎の金額を記録（基礎セット値引き用）
                        if (matchedKey.includes('外基礎')) {
                            gaiKisoAmount = amount + calculateDiscount(amount, discountValue); // 値引き前の金額
                        } else if (matchedKey.includes('中基礎')) {
                            nakaKisoAmount = amount + calculateDiscount(amount, discountValue); // 値引き前の金額
                        }
                    }
                } else if ((matchedCategory === "消毒" && matchedKey === "カビ") || 
                           (matchedCategory === "そのほか" && matchedKey === "カビ")) {
                    amount = calculateKabiPrice(thisQty, selectedProducts);
                    amount -= calculateDiscount(amount, discountValue);
                } else if (matchedCategory === "そのほか" && matchedKey === "BM") {
                    amount = calculateBMPrice(thisQty, selectedProducts);
                    amount -= calculateDiscount(amount, discountValue);
                } else if (matchedCategory === "床下機器" && matchedKey === "SO2買") {
                    // 他の選択商品をチェック
                    const hasSpecialDiscount = selectedProducts.some(product => 
                        product.item && (product.item.includes("DC2") || product.item.includes("60"))
                    );

                    // 特別割引価格または通常価格を適用
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
                selectCandidates.push(candidates);
                selectedProducts.push({category: matchedCategory, item: matchedKey});
                console.log('金額計算結果:', amount);
            } else {
                systemNames.push('');
                systemQtys.push(isKiso && kisoQtyRaw ? kisoQtyRaw : thisQty);
                systemAmounts.push('');
                selectCandidates.push(candidates);
            }
        });

        // 基礎セット値引きの適用（外基礎と中基礎が両方ある場合）
        if (hasGaiKiso && hasNakaKiso) {
            const kisoSetDiscount = 40000;
            totalExTax -= kisoSetDiscount;
            console.log('基礎セット値引き適用:', { 
                gaiKisoAmount, 
                nakaKisoAmount, 
                discount: kisoSetDiscount, 
                totalAfterDiscount: totalExTax 
            });
            
            // 値引き表示を更新
            if (gaiKisoPartIdx >= 0 && gaiKisoPartIdx < discounts.length) {
                discounts[gaiKisoPartIdx] = 'セット';
            }
            if (nakaKisoPartIdx >= 0 && nakaKisoPartIdx < discounts.length) {
                discounts[nakaKisoPartIdx] = 'セット';
            }
        }

        totalInTax = Math.floor(totalExTax * 1.1);
        const pasted = Number(price.toString().replace(/[^0-9.]/g, ''));
        const diff = Math.abs(pasted - totalExTax);
        const isMatch = (totalExTax !== null && Math.floor(diff) === 0);
        console.log('合計金額:', { totalExTax, totalInTax, pasted, diff, isMatch });

        // 表示用テーブル（一致・不一致でクラスを分ける）
        const tableClass = isMatch ? 'match-table' : 'mismatch-table';
        let table = `<table class="${tableClass}" data-line="${lineIdx}">`;
        table += '<tr><th>商品名</th><th>値引</th><th>システム商品名</th><th>数量</th><th>金額(税抜)</th></tr>';
        
        for (let i = 0; i < nameParts.length; i++) {
            let sysCell = '';
            const partState = inputStates[lineIdx]?.parts[i] || { inputValue: '', selectedValue: '' };
            
            // 値引き表示の改善
            let discountDisplay = discounts[i] || '';
            let discountHidden = discountDisplay ? `<input type="hidden" class="discount-keep" value="${discountDisplay}" readonly>` : '';
            
            // 数量表示（管有の場合は空欄）
            let qtyDisplay = systemNames[i] === '一般管理費' ? '' : (systemQtys[i] || '');
            let qtyHidden = qtyDisplay ? `<input type="hidden" class="qty-keep" value="${qtyDisplay}" readonly>` : '';

            // システム商品名のセル
            if (selectCandidates[i] && selectCandidates[i].length > 0) {
                // 部分一致する商品がある場合はセレクトボックス
                const selectedValue = partState.selectedValue || '';
                sysCell = `<select class="system-select" data-line="${lineIdx}" data-part="${i}">
                    <option value="">選択してください</option>
                    ${selectCandidates[i].map(cand => 
                        `<option value="${cand}" ${cand === selectedValue ? 'selected' : ''}>${cand}</option>`
                    ).join('')}
                </select>`;
                console.log(`行 ${lineIdx + 1}, 商品 ${i + 1}: セレクトボックス表示 (${selectCandidates[i].length}件の候補)`);
            } else if (!systemNames[i]) {
                // 完全一致も部分一致もない場合は入力フィールド
                const inputValue = partState.inputValue || inputNames[i];
                sysCell = `<input type="text" class="system-input" data-line="${lineIdx}" data-part="${i}" 
                    placeholder="商品名を入力" value="${inputValue}" />`;
                console.log(`行 ${lineIdx + 1}, 商品 ${i + 1}: 入力フィールド表示 (現在の値: ${inputValue})`);
            } else {
                // 完全一致した商品名を表示
                sysCell = systemNames[i];
                console.log(`行 ${lineIdx + 1}, 商品 ${i + 1}: 完全一致商品表示 (${systemNames[i]})`);
            }

            table += `<tr>
                <td>${inputNames[i]}${discountHidden}</td>
                <td>${discountDisplay}</td>
                <td>${sysCell}</td>
                <td>${qtyDisplay}${qtyHidden}</td>
                <td>${systemAmounts[i] ? formatNumber(systemAmounts[i]) : ''}</td>
            </tr>`;
        }

        // 合計行と一致判定の表示
        table += `<tr class="total-row ${isMatch ? 'match' : 'mismatch'}">
            <td colspan="4">合計</td>
            <td>${formatNumber(totalExTax)}</td>
        </tr>`;
        table += `<tr class="comparison-row ${isMatch ? 'match' : 'mismatch'}">
            <td colspan="5">
                <div class="comparison-details">
                    <span>貼付金額: ${formatNumber(pasted)}</span>
                    <span>計算金額: ${formatNumber(totalExTax)}</span>
                    <span class="difference">差額: ${formatNumber(pasted - totalExTax)}</span>
                    <span class="status">${isMatch ? '一致' : '不一致'}</span>
                </div>
            </td>
        </tr>`;
        table += '</table>';

        resultArea.innerHTML += table;
    });

    // イベントリスナーの設定
    setupEventListeners();
}

// イベントリスナーの設定関数
function setupEventListeners() {
    // セレクトボックスの変更イベント
    document.querySelectorAll('.system-select').forEach(select => {
        select.addEventListener('change', function() {
            const lineIdx = parseInt(this.dataset.line);
            const partIdx = parseInt(this.dataset.part);
            const value = this.value;
            
            // 状態を更新
            if (!inputStates[lineIdx].parts[partIdx]) {
                inputStates[lineIdx].parts[partIdx] = {};
            }
            inputStates[lineIdx].parts[partIdx].selectedValue = value;
            inputStates[lineIdx].parts[partIdx].inputValue = ''; // 入力値をクリア
            
            console.log('セレクトボックス変更:', { line: lineIdx, part: partIdx, value: value });
            renderCheckTable();
        });
    });

    // 入力フィールドの変更イベント
    document.querySelectorAll('.system-input').forEach(input => {
        input.addEventListener('change', function() {
            const lineIdx = parseInt(this.dataset.line);
            const partIdx = parseInt(this.dataset.part);
            const value = this.value.trim();
            
            // 状態を更新
            if (!inputStates[lineIdx].parts[partIdx]) {
                inputStates[lineIdx].parts[partIdx] = {};
            }
            inputStates[lineIdx].parts[partIdx].inputValue = value;
            inputStates[lineIdx].parts[partIdx].selectedValue = ''; // 選択値をクリア
            
            console.log('入力フィールド変更:', { line: lineIdx, part: partIdx, value: value });
            renderCheckTable();
        });
    });
}

// 基礎工事の候補を取得する関数
function getKisoCandidates(category) {
    const kisoData = window.kisoProductsData || {};
    if (category === 'クラック') {
        const categoryData = kisoData['クラック'] || {};
        return Object.keys(categoryData);
    } else {
        const categoryData = kisoData[category] || {};
        return Object.keys(categoryData);
    }
}

function formatNumber(number) {
    return number.toLocaleString();
}

function findPartialMatches(searchName) {
    console.log(`部分一致検索開始: "${searchName}"`);
    const matches = [];
    const normalizedSearch = normalizeProductName(searchName);
    // 通常商品データ
    if (window.goodsData) {
        for (const [category, items] of Object.entries(window.goodsData)) {
            for (const [itemName, itemData] of Object.entries(items)) {
                const normalizedItem = normalizeProductName(itemName);
                if (
                    normalizedItem.includes(normalizedSearch) ||
                    normalizedSearch.includes(normalizedItem) ||
                    calculateSimilarity(normalizedItem, normalizedSearch) > 0.6
                ) {
                    matches.push(itemName);
                }
            }
        }
    }
    // 基礎商品データ
    if (window.kisoProductsData) {
        for (const [category, items] of Object.entries(window.kisoProductsData)) {
            for (const [itemName, itemData] of Object.entries(items)) {
                const normalizedItem = normalizeProductName(itemName);
                if (
                    normalizedItem.includes(normalizedSearch) ||
                    normalizedSearch.includes(normalizedItem) ||
                    calculateSimilarity(normalizedItem, normalizedSearch) > 0.6
                ) {
                    matches.push(itemName);
                }
            }
        }
    }
    // 類似度でソート
    matches.sort((a, b) => {
        const similarityA = calculateSimilarity(normalizeProductName(a), normalizedSearch);
        const similarityB = calculateSimilarity(normalizeProductName(b), normalizedSearch);
        return similarityB - similarityA;
    });
    return matches;
}

function normalizeProductName(name) {
    if (!name) return '';
    // 略称を正規化
    return name
        .replace(/[・\u30fb,、\s]/g, '')
        .replace(/外クラ|外ｸﾗ|外クラック/g, '外クラック')
        .replace(/中両クラ|中両ｸﾗ|中両面クラック/g, '中両面クラック')
        .replace(/中片クラ|中片ｸﾗ|中片面クラック/g, '中片面クラック')
        .replace(/外基礎/g, '外基礎')
        .replace(/中基礎/g, '中基礎')
        .toLowerCase();
}

function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // レーベンシュタイン距離を計算
    const matrix = Array(str1.length + 1).fill().map(() => 
        Array(str2.length + 1).fill(0)
    );

    for (let i = 0; i <= str1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= str2.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,     // 削除
                matrix[i][j - 1] + 1,     // 挿入
                matrix[i - 1][j - 1] + cost  // 置換
            );
        }
    }

    const maxLength = Math.max(str1.length, str2.length);
    const distance = matrix[str1.length][str2.length];
    return 1 - (distance / maxLength);
}

// クリア機能の実装
function clearAllInputs() {
    console.log('=== クリア処理開始 ===');
    
    // 入力状態のクリア
    inputStates = {};
    console.log('入力状態をクリアしました');

    // searchNameのクリア
    searchName = '';
    console.log('検索名をクリアしました');

    // テーブル内の入力フィールドとセレクトボックスをクリア
    const inputs = document.querySelectorAll('.system-input');
    const selects = document.querySelectorAll('.system-select');
    
    inputs.forEach(input => {
        input.value = '';
        console.log(`入力フィールドをクリア: ${input.dataset.line}-${input.dataset.part}`);
    });
    
    selects.forEach(select => {
        select.value = '';
        console.log(`セレクトボックスをクリア: ${select.dataset.line}-${select.dataset.part}`);
    });

    // 結果表示エリアをクリア（正しいIDを使用）
    const resultArea = document.getElementById('result-area');
    if (resultArea) {
        resultArea.innerHTML = '';
        console.log('結果表示エリアをクリアしました');
    }

    // 初期貼付データのクリア
    window.initialPasteData = [];
    console.log('初期貼付データをクリアしました');

    console.log('=== クリア処理完了 ===');
}

// 括弧による値引き表記を処理する関数
function parseGroupDiscount(name) {
    // 外基礎・中基礎が含まれている場合は処理をスキップ
    if (name.includes('外基礎') || name.includes('中基礎')) {
        console.log('外基礎・中基礎が含まれているため、グループ括弧処理をスキップ');
        return { groupDiscount: null, productsInGroup: [], cleanedName: name };
    }
    
    // ネスト対応のグループ括弧検出（全角・半角対応）
    let cleanedName = name;
    let allProcessedProducts = [];
    let i = 0;
    while (i < cleanedName.length) {
        if (cleanedName[i] === '(' || cleanedName[i] === '（') {
            let start = i;
            let parenCount = 1;
            let j = i + 1;
            while (j < cleanedName.length && parenCount > 0) {
                if (cleanedName[j] === '(' || cleanedName[j] === '（') parenCount++;
                else if (cleanedName[j] === ')' || cleanedName[j] === '）') parenCount--;
                j++;
            }
            if (parenCount === 0) {
                let groupEnd = j - 1;
                // 括弧直後の修飾語を抽出（全角％対応）
                let modStart = groupEnd + 1;
                let modEnd = modStart;
                while (modEnd < cleanedName.length) {
                    const modMatch = cleanedName.slice(modEnd).match(/^(新|買|▲[0-9]+(?:\.[0-9]+)?[%％]|▲[0-9,]+円?|▲JA)/);
                    if (modMatch) {
                        modEnd += modMatch[0].length;
                    } else {
                        break;
                    }
                }
                const groupStr = cleanedName.slice(start + 1, groupEnd);
                const modifiersStr = cleanedName.slice(modStart, modEnd);
                // 括弧内の商品名を分割
                const productsInGroup = splitProductsWithParentheses(groupStr);
                // 修飾語をすべて抽出
                const modifiers = [];
                let modMatch;
                const modPattern = /(新|買|▲[0-9]+(?:\.[0-9]+)?[%％]|▲[0-9,]+円?|▲JA)/g;
                while ((modMatch = modPattern.exec(modifiersStr)) !== null) {
                    modifiers.push(modMatch[1].replace(/\s+/g, ''));
                }
                if (productsInGroup.length >= 2) {
                    // 2つ以上ならグループ括弧として展開
                    const processedProducts = productsInGroup.map(product => product + modifiers.join(''));
                    allProcessedProducts = allProcessedProducts.concat(processedProducts);
                    // 元の文字列を展開した商品名で置換
                    cleanedName = cleanedName.slice(0, start) + processedProducts.join('・') + cleanedName.slice(modEnd);
                    // 置換後の位置から再開
                    i = start + processedProducts.join('・').length - 1;
                } else {
                    // 1つだけなら商品名の一部として扱う（置換しない）
                    i = groupEnd;
                }
            } else {
                // 括弧が閉じていない場合はbreak
                break;
            }
        }
        i++;
    }
    return { groupDiscount: null, productsInGroup: allProcessedProducts, cleanedName };
}

// 商品名に()が含まれている場合を考慮した分割関数
function splitProductsWithParentheses(productsStr) {
    const products = [];
    let current = '';
    let parenCount = 0;
    for (let i = 0; i < productsStr.length; i++) {
        const char = productsStr[i];
        if (char === '(') {
            parenCount++;
            current += char;
        } else if (char === ')') {
            parenCount--;
            current += char;
        } else if ((char === '・' || char === '･') && parenCount === 0) {
            if (current.trim()) {
                products.push(current.trim());
                current = '';
            }
        } else {
            current += char;
        }
    }
    if (current.trim()) {
        products.push(current.trim());
    }
    return products;
}

function normalizeKisoHeight(height) {
    if (height <= 30) return 30;
    if (height <= 40) return 40;
    if (height <= 50) return 50;
    if (height <= 60) return 60;
    if (height <= 70) return 70;
    return 80;
} 