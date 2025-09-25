// グローバル変数
let selectedProducts = [];
let productCounter = { normal: 6, basic: 3 };
let isRecalculating = false; // 再計算中のフラグ

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

function initializeApp() {
    // 商品データを読み込み
    loadProductData();
    // Firestore からの読み込み（成功時は core_data_fetch 側で再度 loadProductData を呼ぶ）
    try {
        if (window.FEATURE_USE_FIRESTORE && window.CoreDataFetch && typeof window.CoreDataFetch.loadData === 'function') {
            window.CoreDataFetch.loadData();
        }
    } catch (e) { 
        console.error('Error loading Firestore data:', e);
    }
    
    // タブ切り替えを設定
    setupTabNavigation();
    
    // 初期計算と選択状態の更新
    updateSelectedProducts();
}

function setupEventListeners() {
    // 商品追加ボタン
    document.getElementById('add-product-button').addEventListener('click', addNewProduct);
    
    // 計算ボタン
    document.getElementById('calculate-button').addEventListener('click', calculateAll);
    
    // 全削除ボタン
    document.getElementById('clear-all-button').addEventListener('click', clearAllProducts);
    
    // 管理費チェックボックス
    document.getElementById('management-fee-checkbox').addEventListener('change', updateTotal);
    
    // Excel連携ボタン
    document.getElementById('copy-to-excel-button').addEventListener('click', copyToExcel);
}

// データ更新機能
function refreshData() {
    // ボタンを一時的に無効化
    const refreshButton = document.querySelector('.refresh-button');
    const originalText = refreshButton.textContent;
    refreshButton.textContent = '🔄 更新中...';
    refreshButton.disabled = true;
    
    try {
        // Firestoreからデータを再読み込み
        if (window.FEATURE_USE_FIRESTORE && window.CoreDataFetch && typeof window.CoreDataFetch.loadData === 'function') {
            window.CoreDataFetch.loadData().then(() => {
                // データ読み込み完了後、商品リストを再構築
                loadProductData();
                updateSelectedProducts();
                
                // ボタンを元に戻す
                refreshButton.textContent = originalText;
                refreshButton.disabled = false;
                
                // 成功メッセージを表示
                showRefreshStatus('✅ データを更新しました');
            }).catch((error) => {
                console.error('データ更新エラー:', error);
                refreshButton.textContent = originalText;
                refreshButton.disabled = false;
                showRefreshStatus('❌ データ更新に失敗しました');
            });
        } else {
            // Firestoreが無効な場合は通常のリロード
            window.location.reload();
        }
    } catch (error) {
        console.error('データ更新エラー:', error);
        refreshButton.textContent = originalText;
        refreshButton.disabled = false;
        showRefreshStatus('❌ データ更新に失敗しました');
    }
}

// 更新ステータス表示
function showRefreshStatus(message) {
    const statusDiv = document.createElement('div');
    statusDiv.className = 'refresh-status';
    statusDiv.textContent = message;
    statusDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(statusDiv);
    
    // 3秒後に削除
    setTimeout(() => {
        if (statusDiv.parentNode) {
            statusDiv.parentNode.removeChild(statusDiv);
        }
    }, 3000);
}

// 現在フォーム上で選択中の商品（通常/基礎）から、ルール判定用の文脈を構築
function buildSelectedContext() {
    const ctx = [];
    try {
        for (let i = 1; i <= productCounter.normal; i++) {
            const c = (document.getElementById(`normal-category-${i}`) || {}).value;
            const it = (document.getElementById(`normal-item-${i}`) || {}).value;
            if (c && it) ctx.push({ category: c, item: it });
        }
        for (let i = 1; i <= productCounter.basic; i++) {
            const c = (document.getElementById(`basic-category-${i}`) || {}).value;
            const it = (document.getElementById(`basic-item-${i}`) || {}).value;
            if (c && it) ctx.push({ category: c, item: it });
        }
    } catch (_) { /* ignore */ }
    return ctx;
}

function loadProductData() {
    // 通常商品のカテゴリを読み込み（1-6）
    const preferred = ['消毒','床下機器','天井機器','断熱遮熱','基礎関連','そのほか','害虫','旧商品','新規工事','追加工事','クラック'];
    const orderMap = new Map(preferred.map((v,i)=>[v,i]));
    const normalCategories = Object.keys(productsData).sort((a,b)=>{
        const ia = orderMap.has(a)?orderMap.get(a):Number.MAX_SAFE_INTEGER;
        const ib = orderMap.has(b)?orderMap.get(b):Number.MAX_SAFE_INTEGER;
        if (ia!==ib) return ia-ib;
        return String(a).localeCompare(String(b));
    });
    for (let i = 1; i <= 6; i++) {
        const normalCategorySelect = document.getElementById(`normal-category-${i}`);
        if (normalCategorySelect) {
            // 既存をクリアしてから再生成
            normalCategorySelect.innerHTML = '<option value="">選択してください</option>';
            normalCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                normalCategorySelect.appendChild(option);
            });
        }
    }

    // 基礎商品のカテゴリを読み込み（1-3）
    const basicCategories = Object.keys(kisoProductsData).sort((a,b)=>{
        const ia = orderMap.has(a)?orderMap.get(a):Number.MAX_SAFE_INTEGER;
        const ib = orderMap.has(b)?orderMap.get(b):Number.MAX_SAFE_INTEGER;
        if (ia!==ib) return ia-ib;
        return String(a).localeCompare(String(b));
    });
    for (let i = 1; i <= 3; i++) {
        const basicCategorySelect = document.getElementById(`basic-category-${i}`);
        if (basicCategorySelect) {
            // 既存をクリアしてから再生成
            basicCategorySelect.innerHTML = '<option value="">選択してください</option>';
            basicCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                basicCategorySelect.appendChild(option);
            });
        }
    }
}

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // タブボタンの状態を更新
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // タブコンテンツの表示を切り替え
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
        });
    });
}

function updateNormalItems(productNumber) {
    const categorySelect = document.getElementById(`normal-category-${productNumber}`);
    const itemSelect = document.getElementById(`normal-item-${productNumber}`);
    
    // 小項目をクリア
    itemSelect.innerHTML = '<option value="">大項目を先に選択してください</option>';
    
    if (categorySelect.value) {
        const cat = categorySelect.value;
        const siMap = (window.productsSortIndexMap && window.productsSortIndexMap[cat]) || null;
        const items = Object.keys(productsData[cat]).sort((a,b)=>{
            // 1) Firestore の sortIndex マップ
            const sai = siMap && (typeof siMap[a] === 'number') ? siMap[a] : null;
            const sbi = siMap && (typeof siMap[b] === 'number') ? siMap[b] : null;
            if (sai!=null && sbi!=null) return sai - sbi;
            if (sai!=null) return -1;
            if (sbi!=null) return 1;
            // 2) productsData 内の _sort（後方互換）
            const sa = (productsData[cat][a]||{})._sort;
            const sb = (productsData[cat][b]||{})._sort;
            if (Number.isFinite(sa) && Number.isFinite(sb)) return sa - sb;
            if (Number.isFinite(sa)) return -1;
            if (Number.isFinite(sb)) return 1;
            // 3) 名前昇順
            return String(a).localeCompare(String(b));
        });
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            option.textContent = item;
            itemSelect.appendChild(option);
        });
        itemSelect.disabled = false;
    } else {
        itemSelect.disabled = true;
    }
    
    // 商品選択が変更されたら全商品を再計算（値引きルールの適用のため）
    setTimeout(() => {
        recalculateAllProducts();
    }, 100);
}

function updateBasicItems(productNumber) {
    const categorySelect = document.getElementById(`basic-category-${productNumber}`);
    const itemSelect = document.getElementById(`basic-item-${productNumber}`);
    
    // 小項目をクリア
    itemSelect.innerHTML = '<option value="">大項目を先に選択してください</option>';
    
    if (categorySelect.value) {
        const cat = categorySelect.value;
        const siMap = (window.productsSortIndexMap && window.productsSortIndexMap[cat]) || null;
        const items = Object.keys(kisoProductsData[cat]).sort((a,b)=>{
            const sai = siMap && (typeof siMap[a] === 'number') ? siMap[a] : null;
            const sbi = siMap && (typeof siMap[b] === 'number') ? siMap[b] : null;
            if (sai!=null && sbi!=null) return sai - sbi;
            if (sai!=null) return -1;
            if (sbi!=null) return 1;
            const sa = (kisoProductsData[cat][a]||{})._sort;
            const sb = (kisoProductsData[cat][b]||{})._sort;
            if (Number.isFinite(sa) && Number.isFinite(sb)) return sa - sb;
            if (Number.isFinite(sa)) return -1;
            if (Number.isFinite(sb)) return 1;
            return String(a).localeCompare(String(b));
        });
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item;
            // 追加工事カテゴリは表示名を「外基礎追/中基礎追」にする
            if (categorySelect.value === '追加工事') {
                if (item === '外基礎') option.textContent = '外基礎追';
                else if (item === '中基礎') option.textContent = '中基礎追';
                else option.textContent = item;
            } else {
                option.textContent = item;
            }
            itemSelect.appendChild(option);
        });
        itemSelect.disabled = false;
    } else {
        itemSelect.disabled = true;
    }
    
    // 商品選択が変更されたら全商品を再計算（値引きルールの適用のため）
    setTimeout(() => {
        recalculateAllProducts();
    }, 100);
}

function calculateNormalProduct(productNumber) {
    calculateNormalProductInternal(productNumber);
    
    // 個別計算後、全商品を再計算（値引きルールの適用のため）
    if (!isRecalculating) {
        setTimeout(() => {
            recalculateAllProducts();
        }, 50);
    }
}

function calculateNormalProductInternal(productNumber) {
    const category = document.getElementById(`normal-category-${productNumber}`).value;
    const item = document.getElementById(`normal-item-${productNumber}`).value;
    const quantity = parseFloat(document.getElementById(`normal-quantity-${productNumber}`).value) || 0;
    const discount = parseFloat(document.getElementById(`normal-discount-${productNumber}`).value) || 0;

    // 数量が未入力でも、基本料金（base）は計算したいので quantity<=0 では止めない
    if (!category || !item) {
        document.getElementById(`normal-result-ex-${productNumber}`).textContent = '0円';
        document.getElementById(`normal-result-in-${productNumber}`).textContent = '0円';
        return;
    }

    // 価格計算（CorePricing + ルール適用）
    let exTax = 0;
    let inTax = 0;
    try {
        if (window.CorePricing && typeof window.CorePricing.calculateProductLine === 'function') {
            const ctx = buildSelectedContext();
            const pd = (window.productsData || window.goodsData || productsData);
            const kd = (window.kisoProductsData || kisoProductsData);
            const res = window.CorePricing.calculateProductLine({
                type: 'normal',
                category: category,
                item: item,
                quantity: quantity,
                discountValue: discount,
                selectedProductsContext: ctx,
                productsData: pd,
                kisoProductsData: kd
            });
            exTax = Number(res && res.ex) || 0;
            inTax = Number(res && res.inTax) || Math.floor(exTax * 1.1);
        } else {
            // フォールバック（旧実装）
            const productData = productsData[category][item];
            if (!productData) return;
            exTax = productData.base || 0;
            if (productData.areaThreshold !== undefined) {
                if (quantity > productData.areaThreshold) {
                    exTax += (quantity - productData.areaThreshold) * productData.price;
                }
            } else {
                exTax += quantity * productData.price;
            }
            let discountAmount = 0;
            if (discount > 0) {
                discountAmount = discount < 100 ? (exTax * (discount / 100)) : discount;
            }
            exTax = Math.max(0, exTax - discountAmount);
            inTax = Math.floor(exTax * 1.1);
        }
    } catch (_) {
        exTax = 0; inTax = 0;
    }

    // 結果を表示
    document.getElementById(`normal-result-ex-${productNumber}`).textContent = exTax.toLocaleString() + '円';
    document.getElementById(`normal-result-in-${productNumber}`).textContent = inTax.toLocaleString() + '円';

    // 選択商品リストに追加
    updateSelectedProducts();
}

function calculateBasicProduct(productNumber) {
    calculateBasicProductInternal(productNumber);
    
    // 個別計算後、全商品を再計算（値引きルールの適用のため）
    if (!isRecalculating) {
        setTimeout(() => {
            recalculateAllProducts();
        }, 50);
    }
}

function calculateBasicProductInternal(productNumber) {
    const category = document.getElementById(`basic-category-${productNumber}`).value;
    const item = document.getElementById(`basic-item-${productNumber}`).value;
    const height = document.getElementById(`basic-height-${productNumber}`).value;
    const length = parseFloat(document.getElementById(`basic-length-${productNumber}`).value) || 0;
    const discount = parseFloat(document.getElementById(`basic-discount-${productNumber}`).value) || 0;

    if (!category || !item || !height || length <= 0) {
        document.getElementById(`basic-result-ex-${productNumber}`).textContent = '0円';
        document.getElementById(`basic-result-in-${productNumber}`).textContent = '0円';
        return;
    }

    // 価格計算（CorePricing + ルール適用）
    let exTax = 0;
    let inTax = 0;
    try {
        if (window.CorePricing && typeof window.CorePricing.calculateProductLine === 'function') {
            const ctx = buildSelectedContext();
            const pd = (window.productsData || window.goodsData || productsData);
            const kd = (window.kisoProductsData || kisoProductsData);
            const res = window.CorePricing.calculateProductLine({
                type: 'kiso',
                category: category,
                item: item,
                height: height,
                length: length,
                discountValue: discount,
                selectedProductsContext: ctx,
                productsData: pd,
                kisoProductsData: kd
            });
            exTax = Number(res && res.ex) || 0;
            inTax = Number(res && res.inTax) || Math.floor(exTax * 1.1);
        } else {
            // フォールバック（旧実装）
            const productData = kisoProductsData[category][item];
            if (!productData) return;
            const heightData = productData["高さ別価格"][height];
            if (!heightData) return;
            exTax = heightData["基本価格"] || 0;
            const basicLength = productData["基本長さ"] || 0;
            if (length > basicLength) {
                exTax += (length - basicLength) * (heightData["長さ加算"] || 0);
            }
            let discountAmount = 0;
            if (discount > 0) {
                discountAmount = discount < 100 ? (exTax * (discount / 100)) : discount;
            }
            exTax = Math.max(0, exTax - discountAmount);
            inTax = Math.floor(exTax * 1.1);
        }
    } catch (_) {
        exTax = 0; inTax = 0;
    }

    // 結果を表示
    document.getElementById(`basic-result-ex-${productNumber}`).textContent = exTax.toLocaleString() + '円';
    document.getElementById(`basic-result-in-${productNumber}`).textContent = inTax.toLocaleString() + '円';

    // 選択商品リストに追加
    updateSelectedProducts();
}

function updateSelectedProducts() {
    const productList = document.getElementById('selected-products-list');
    productList.innerHTML = '';

    selectedProducts = [];

    // 通常商品をチェック
    for (let i = 1; i <= productCounter.normal; i++) {
        const category = document.getElementById(`normal-category-${i}`).value;
        const item = document.getElementById(`normal-item-${i}`).value;
        const quantity = parseFloat(document.getElementById(`normal-quantity-${i}`).value) || 0;
        const exTax = document.getElementById(`normal-result-ex-${i}`).textContent;

        if (category && item && quantity > 0) {
            const discount = parseFloat(document.getElementById(`normal-discount-${i}`).value) || 0;
            // unitLabelを取得
            const productsData = window.productsData || window.goodsData || {};
            const productData = productsData[category] && productsData[category][item];
            const unitLabel = productData ? productData.unitLabel : null;
            
            selectedProducts.push({
                type: 'normal',
                number: i,
                category: category,
                item: item,
                quantity: quantity,
                discount: discount,
                exTax: exTax,
                unitLabel: unitLabel
            });
        }
    }

    // 基礎商品をチェック
    for (let i = 1; i <= productCounter.basic; i++) {
        const category = document.getElementById(`basic-category-${i}`).value;
        const item = document.getElementById(`basic-item-${i}`).value;
        const height = document.getElementById(`basic-height-${i}`).value;
        const length = parseFloat(document.getElementById(`basic-length-${i}`).value) || 0;
        const exTax = document.getElementById(`basic-result-ex-${i}`).textContent;

        if (category && item && height && length > 0) {
            const discount = parseFloat(document.getElementById(`basic-discount-${i}`).value) || 0;
            // unitLabelを取得
            const kisoProductsData = window.kisoProductsData || {};
            const productData = kisoProductsData[category] && kisoProductsData[category][item];
            const unitLabel = productData ? productData.unitLabel : null;
            
            selectedProducts.push({
                type: 'basic',
                number: i,
                category: category,
                item: item,
                height: height,
                length: length,
                discount: discount,
                exTax: exTax,
                unitLabel: unitLabel
            });
        }
    }

    // 商品リストを表示
    if (selectedProducts.length === 0) {
        productList.innerHTML = '<li class="empty-state">商品を選択すると、ここに表示されます</li>';
    } else {
        selectedProducts.forEach((product, index) => {
            const li = document.createElement('li');
            li.className = 'product-item';
            
            let qtyDisplay = '';
            if (product.type === 'basic') {
                if (product.height && (product.length || product.length === 0)) {
                    qtyDisplay = `${product.height}*${product.length}`;
                } else if (product.length || product.length === 0) {
                    qtyDisplay = String(product.length);
                } else {
                    qtyDisplay = '';
                }
                // 基礎商品の助数詞を追加
                if (product.unitLabel && product.unitLabel !== null && product.unitLabel !== '') {
                    qtyDisplay += product.unitLabel;
                }
            } else {
                qtyDisplay = product.quantity;
                // 通常商品の助数詞を追加
                if (product.unitLabel && product.unitLabel !== null && product.unitLabel !== '') {
                    qtyDisplay += product.unitLabel;
                }
            }
            let details = `数量: ${qtyDisplay} | ${product.type === 'normal' ? '通常商品' : '基礎商品'}`;
            
            // 値引き表示の作成
            let discountDisplay = '';
            if (product.discount > 0) {
                if (product.discount < 100) {
                    // 2桁以下は%として表示
                    discountDisplay = `<span class="discount-info">▲${product.discount}%</span>`;
                } else {
                    // 3桁以上は金額として表示
                    discountDisplay = `<span class="discount-info">▲${product.discount.toLocaleString()}円</span>`;
                }
            }
            
            li.innerHTML = `
                <div class="product-info">
                    <div class="product-name">
                        ${product.category} - ${product.item}
                        ${discountDisplay}
                    </div>
                    <div class="product-details">${details}</div>
                </div>
                <div class="product-price">${product.exTax}</div>
            `;
            productList.appendChild(li);
        });
    }

    // 選択状態の視覚化を更新
    updateProductSelectionVisuals();
    updateTotal();
}

function updateProductSelectionVisuals() {
    // すべての商品フォームの選択状態をリセット
    document.querySelectorAll('.product-form').forEach(form => {
        form.classList.remove('selected');
    });

    // 選択された商品に選択状態のスタイルを適用
    selectedProducts.forEach(product => {
        const productId = `${product.type}-product-${product.number}`;
        const productForm = document.getElementById(productId);
        if (productForm) {
            productForm.classList.add('selected');
        }
    });

    // バツボタンの表示制御
    document.querySelectorAll('.product-form').forEach(form => {
        const removeButton = form.querySelector('.remove-button');
        if (removeButton) {
            const formId = form.id;
            const isSelected = selectedProducts.some(product => 
                `${product.type}-product-${product.number}` === formId
            );
            
            // 選択された商品のバツボタンは非表示、未選択の商品は表示
            removeButton.style.display = isSelected ? 'none' : 'flex';
        }
    });
}

function updateTotal() {
    let totalExTax = 0;

    // 選択商品の合計を計算
    selectedProducts.forEach(product => {
        const price = parseFloat(product.exTax.replace(/[^\d]/g, '')) || 0;
        totalExTax += price;
    });

    // 基礎セット割: 新規工事/外基礎 と 新規工事/中基礎 が同時にある場合、基礎合計から40,000円減額
    (function applyKisoSetDiscount(){
        let hasGai = false, hasNaka = false;
        let kisoSum = 0;
        selectedProducts.forEach(p=>{
            if (p.type === 'basic' && p.category === '新規工事') {
                const amt = parseFloat((p.exTax||'').replace(/[^\d]/g,'')) || 0;
                if (p.item === '外基礎') { hasGai = true; kisoSum += amt; }
                if (p.item === '中基礎') { hasNaka = true; kisoSum += amt; }
            }
        });
        if (hasGai && hasNaka) {
            totalExTax -= 40000;
        }
    })();

    // 管理費を追加
    const managementFeeCheckbox = document.getElementById('management-fee-checkbox');
    if (managementFeeCheckbox.checked) {
        totalExTax += 20000;
    }

    const totalInTax = Math.floor(totalExTax * 1.1);

    // 合計を表示
    document.getElementById('total-ex-tax').textContent = totalExTax.toLocaleString() + '円';
    document.getElementById('total-in-tax').textContent = totalInTax.toLocaleString() + '円';
}

function addNewProduct() {
    // 現在アクティブなタブを取得
    const activeTab = document.querySelector('.tab-button.active');
    const tabType = activeTab.getAttribute('data-tab');

    if (tabType === 'normal-products') {
        addNormalProduct();
    } else if (tabType === 'basic-products') {
        addBasicProduct();
    }
}

function addNormalProduct() {
    productCounter.normal++;
    const newProductNumber = productCounter.normal;

    const newProductHTML = `
        <div class="product-form" id="normal-product-${newProductNumber}">
            <div class="form-header">
                <h3 class="form-title">通常商品 ${newProductNumber}</h3>
                <button class="remove-button" onclick="removeProduct('normal-product-${newProductNumber}')">
                    ✕
                </button>
            </div>
            <div class="normal-form-grid">
                <div class="form-group">
                    <label class="form-label" for="normal-category-${newProductNumber}">大項目選択</label>
                    <select class="form-select" id="normal-category-${newProductNumber}" onchange="updateNormalItems(${newProductNumber})">
                        <option value="">選択してください</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="normal-item-${newProductNumber}">小項目選択</label>
                    <select class="form-select" id="normal-item-${newProductNumber}" disabled onchange="calculateNormalProduct(${newProductNumber})">
                        <option value="">大項目を先に選択してください</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="normal-quantity-${newProductNumber}">数量</label>
                    <input type="number" class="form-input" id="normal-quantity-${newProductNumber}" min="0" step="1" onchange="calculateNormalProduct(${newProductNumber})">
                </div>
                <div class="form-group">
                    <label class="form-label" for="normal-discount-${newProductNumber}">値引</label>
                    <input type="number" class="form-input" id="normal-discount-${newProductNumber}" min="0" step="1" onchange="calculateNormalProduct(${newProductNumber})">
                </div>
            </div>
            <div class="calculation-result">
                <div class="result-header">計算結果</div>
                <div class="result-grid">
                    <div class="result-item">
                        <div class="result-label">税抜き</div>
                        <div class="result-value ex-tax" id="normal-result-ex-${newProductNumber}">0円</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">税込み</div>
                        <div class="result-value" id="normal-result-in-${newProductNumber}">0円</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const normalProductsContainer = document.getElementById('normal-products');
    normalProductsContainer.insertAdjacentHTML('beforeend', newProductHTML);

    // カテゴリオプションを追加
    const categorySelect = document.getElementById(`normal-category-${newProductNumber}`);
    const preferred = ['消毒','床下機器','天井機器','断熱遮熱','基礎関連','そのほか','害虫','旧商品','新規工事','追加工事','クラック'];
    const orderMap = new Map(preferred.map((v,i)=>[v,i]));
    const normalCategories = Object.keys(productsData).sort((a,b)=>{
        const ia = orderMap.has(a)?orderMap.get(a):Number.MAX_SAFE_INTEGER;
        const ib = orderMap.has(b)?orderMap.get(b):Number.MAX_SAFE_INTEGER;
        if (ia!==ib) return ia-ib;
        return String(a).localeCompare(String(b));
    });
    normalCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
    
    // 商品追加後、全商品を再計算（値引きルールの適用のため）
    setTimeout(() => {
        recalculateAllProducts();
    }, 100);
}

function addBasicProduct() {
    productCounter.basic++;
    const newProductNumber = productCounter.basic;

    const newProductHTML = `
        <div class="product-form" id="basic-product-${newProductNumber}">
            <div class="form-header">
                <h3 class="form-title">基礎商品 ${newProductNumber}</h3>
                <button class="remove-button" onclick="removeProduct('basic-product-${newProductNumber}')">
                    ✕
                </button>
            </div>
            <div class="basic-form-grid">
                <div class="form-group">
                    <label class="form-label" for="basic-category-${newProductNumber}">大項目選択</label>
                    <select class="form-select" id="basic-category-${newProductNumber}" onchange="updateBasicItems(${newProductNumber})">
                        <option value="">選択してください</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="basic-item-${newProductNumber}">小項目選択</label>
                    <select class="form-select" id="basic-item-${newProductNumber}" disabled onchange="calculateBasicProduct(${newProductNumber})">
                        <option value="">大項目を先に選択してください</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="basic-height-${newProductNumber}">基礎高</label>
                    <select class="form-select" id="basic-height-${newProductNumber}" onchange="calculateBasicProduct(${newProductNumber})">
                        <option value="">選択してください</option>
                        <option value="30">30cm</option>
                        <option value="40">40cm</option>
                        <option value="50">50cm</option>
                        <option value="60">60cm</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="basic-length-${newProductNumber}">長さ</label>
                    <input type="number" class="form-input" id="basic-length-${newProductNumber}" min="0" step="1" onchange="calculateBasicProduct(${newProductNumber})">
                </div>
                <div class="form-group">
                    <label class="form-label" for="basic-discount-${newProductNumber}">値引</label>
                    <input type="number" class="form-input" id="basic-discount-${newProductNumber}" min="0" step="1" onchange="calculateBasicProduct(${newProductNumber})">
                </div>
            </div>
            <div class="calculation-result">
                <div class="result-header">計算結果</div>
                <div class="result-grid">
                    <div class="result-item">
                        <div class="result-label">税抜き</div>
                        <div class="result-value ex-tax" id="basic-result-ex-${newProductNumber}">0円</div>
                    </div>
                    <div class="result-item">
                        <div class="result-label">税込み</div>
                        <div class="result-value" id="basic-result-in-${newProductNumber}">0円</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const basicProductsContainer = document.getElementById('basic-products');
    basicProductsContainer.insertAdjacentHTML('beforeend', newProductHTML);

    // カテゴリオプションを追加
    const categorySelect = document.getElementById(`basic-category-${newProductNumber}`);
    const preferred = ['消毒','床下機器','天井機器','断熱遮熱','基礎関連','そのほか','害虫','旧商品','新規工事','追加工事','クラック'];
    const orderMap = new Map(preferred.map((v,i)=>[v,i]));
    const basicCategories = Object.keys(kisoProductsData).sort((a,b)=>{
        const ia = orderMap.has(a)?orderMap.get(a):Number.MAX_SAFE_INTEGER;
        const ib = orderMap.has(b)?orderMap.get(b):Number.MAX_SAFE_INTEGER;
        if (ia!==ib) return ia-ib;
        return String(a).localeCompare(String(b));
    });
    basicCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
    
    // 商品追加後、全商品を再計算（値引きルールの適用のため）
    setTimeout(() => {
        recalculateAllProducts();
    }, 100);
}

function removeProduct(productId) {
    const productElement = document.getElementById(productId);
    if (productElement) {
        productElement.remove();
        // 商品削除後、全商品を再計算（値引きルールの適用のため）
        setTimeout(() => {
            recalculateAllProducts();
        }, 100);
    }
}

function calculateAll() {
    // すべての商品を再計算
    for (let i = 1; i <= productCounter.normal; i++) {
        calculateNormalProduct(i);
    }
    for (let i = 1; i <= productCounter.basic; i++) {
        calculateBasicProduct(i);
    }
}

// 全商品の価格を再計算（値引きルールの適用を含む）
function recalculateAllProducts() {
    if (isRecalculating) return; // 再計算中の場合はスキップ
    isRecalculating = true;
    
    try {
        // 通常商品を再計算
        for (let i = 1; i <= productCounter.normal; i++) {
            const category = document.getElementById(`normal-category-${i}`).value;
            const item = document.getElementById(`normal-item-${i}`).value;
            if (category && item) {
                calculateNormalProductInternal(i); // 内部計算関数を使用
            }
        }
        
        // 基礎商品を再計算
        for (let i = 1; i <= productCounter.basic; i++) {
            const category = document.getElementById(`basic-category-${i}`).value;
            const item = document.getElementById(`basic-item-${i}`).value;
            if (category && item) {
                calculateBasicProductInternal(i); // 内部計算関数を使用
            }
        }
        
        // 選択商品リストと合計を更新
        updateSelectedProducts();
    } finally {
        isRecalculating = false;
    }
}

function clearAllProducts() {
    if (confirm('すべての商品を削除しますか？')) {
        // 既存フォームを完全に削除
        const normalContainer = document.getElementById('normal-products');
        const basicContainer  = document.getElementById('basic-products');
        if (normalContainer) normalContainer.innerHTML = '';
        if (basicContainer)  basicContainer.innerHTML  = '';

        // カウンターを初期化
        productCounter = { normal: 0, basic: 0 };

        // 通常商品 1〜6 を再生成
        for (let i = 0; i < 6; i++) { addNormalProduct(); }
        // 基礎商品 1〜3 を再生成
        for (let i = 0; i < 3; i++) { addBasicProduct(); }

        // 結果値は0表示のまま、右パネルの選択商品リストも空に
        updateSelectedProducts();
        
        // 全商品リセット後、全商品を再計算（値引きルールの適用のため）
        setTimeout(() => {
            recalculateAllProducts();
        }, 100);
    }
}

// Excel連携機能
function copyToExcel() {
    if (selectedProducts.length === 0) {
        alert('商品が選択されていません。商品を選択してから再度お試しください。');
        return;
    }

    // データを準備
    const excelData = {
        timestamp: new Date().toISOString(),
        items: [],
        totalExTax: 0,
        totalInTax: 0,
        managementFee: document.getElementById('management-fee-checkbox').checked
    };

    // 選択された商品を配列に追加
    selectedProducts.forEach(product => {
        const price = parseFloat(product.exTax.replace(/[^\d]/g, '')) || 0;

        // 商品名の構築（小項目名 + 値引き情報）
        let productName = product.item;
        if (product.discount > 0) {
            if (product.discount < 100) {
                // 2桁以下は%として表示
                productName += `▲${product.discount}%`;
            } else {
                // 3桁以上は金額として表示
                productName += `▲${product.discount.toLocaleString()}円`;
            }
        }

        // 数量の表記（基礎/クラックは 高さ*長さ で保存）
        let quantityOut = '';
        if (product.type === 'basic') {
            if (product.height !== undefined && product.height !== '' && product.length !== undefined) {
                quantityOut = `${product.height}*${product.length}`;
            } else if (product.length !== undefined) {
                quantityOut = String(product.length);
            }
        } else {
            quantityOut = product.quantity;
        }

        excelData.items.push({
            category: product.category,
            item: productName,
            type: product.type === 'normal' ? '通常商品' : '基礎商品',
            quantity: quantityOut,
            height: product.height || '',
            discount: product.discount || 0,
            amount: price,
            unitLabel: product.unitLabel || null
        });
        excelData.totalExTax += price;
    });

    // 基礎セット割引の適用（合計から40,000円減額 / 表示名は別途追加）
    (function applyKisoSetDiscount(){
        let hasGai = false, hasNaka = false;
        selectedProducts.forEach(p=>{
            if (p.type === 'basic' && p.category === '新規工事') {
                if (p.item === '外基礎') hasGai = true;
                if (p.item === '中基礎') hasNaka = true;
            }
        });
        if (hasGai && hasNaka) {
            excelData.totalExTax -= 40000;
            excelData.hasKisoSet = true;
        } else {
            excelData.hasKisoSet = false;
        }
    })();

    // 管理費を追加
    if (excelData.managementFee) {
        excelData.totalExTax += 20000;
    }

    excelData.totalInTax = Math.floor(excelData.totalExTax * 1.1);

    // クリップボード用のテキスト形式を作成（税抜金額を送信）
    const clipboardText = createClipboardText(excelData);

    // クリップボードにコピー（仕様は変更しない）
    navigator.clipboard.writeText(clipboardText).then(() => {
        // ボタン直下に実行結果を3秒表示
        const namesJoined = (function(){
            const arr = [];
            excelData.items.forEach(it=> arr.push(it.item));
            if (excelData.managementFee) arr.push('管有');
            return arr.join('・');
        })();
        const quantitiesJoined = excelData.items.map(it=> it.quantity).join('/');
        const amountStr = excelData.totalExTax.toLocaleString() + '円';
        showCopyStatus(namesJoined, quantitiesJoined, amountStr);
    }).catch(err => {
        console.error('クリップボードへのコピーに失敗しました:', err);
        alert('クリップボードへのコピーに失敗しました。ブラウザの設定を確認してください。');
    });
}

function createClipboardText(data) {
    // VBAで解析しやすい形式でテキストを作成（シンプル版）
    let clipboardText = '';
    
    // 商品名（・区切り）
    let productNames = [];
    if (data.hasKisoSet) {
        // 基礎セット成立時は、個別の外基礎・中基礎は出力せず、セット表記のみ出す
        data.items.forEach(item => {
            const isKisoPair = (item.category === '新規工事') && (item.item === '外基礎' || item.item === '中基礎');
            if (!isKisoPair) productNames.push(item.item);
        });
    } else {
        data.items.forEach(item => {
            productNames.push(item.item);
        });
    }
    // 基礎セットが成立している場合、明示トークンを追加
    if (data.hasKisoSet) {
        productNames.push('(外基礎・中基礎)▲ｾｯﾄ');
    }
    
    // 管理費がある場合は最後に「管有」を追加
    if (data.managementFee) {
        productNames.push('管有');
    }
    
    clipboardText += productNames.join('・') + ',';
    
    // 数量（スラッシュ区切り）
    let quantities = [];
    data.items.forEach(item => {
        let qty = item.quantity;
        // 助数詞がある場合は追加
        if (item.unitLabel && item.unitLabel !== null && item.unitLabel !== '') {
            qty += item.unitLabel;
        }
        quantities.push(qty);
    });
    clipboardText += quantities.join('/') + ',';
    
    // 金額（カンマなし）
    clipboardText += data.totalExTax.toString();
    
    return clipboardText;
}

function showCopyStatus(productNames, quantities, amount) {
    const statusElement = document.getElementById('copy-status');
    if (statusElement) {
        // 表示文面を差し替え
        const namesText = productNames ? String(productNames) : '';
        const qtyText = quantities ? String(quantities) : '';
        const amtText = amount ? String(amount) : '';
        statusElement.innerHTML = `✅ コピーしました<br>商品名：${namesText}<br>数量：${qtyText}<br>金額：${amtText}<br>Excelへ進んでください`;
        statusElement.style.display = 'block';
    }
    
    // 3秒後に非表示
    setTimeout(() => {
        if (statusElement) statusElement.style.display = 'none';
    }, 3000);
}
