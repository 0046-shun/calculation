// グローバル変数と基本的なユーティリティ関数
let selectedProducts = [];

// 金額を3桁区切りにする関数
function formatNumber(num) {
    if (Number.isInteger(num)) {
        return num.toLocaleString();
    } else {
        return num.toLocaleString(undefined, { 
            minimumFractionDigits: 1, 
            maximumFractionDigits: 1 
        });
    }
}

// カビの価格を計算する関数
function calculateKabiPrice(quantity, selectedProducts) {
    // 常に「そのほか」カテゴリのカビデータを使用（割引条件が設定されているため）
    const kabiData = productsData["そのほか"]["カビ"];
    let appliedPrice = kabiData.price; // 基本価格: 2500円

    console.log('=== カビ価格計算開始 ===');
    console.log('選択商品一覧:', selectedProducts);
    console.log('数量:', quantity);
    console.log('カビデータ:', kabiData);

    // 第1条件: 消毒カテゴリがあれば1000円
    const hasDisinfection = selectedProducts.some(product => 
        product.category === "消毒"
    );
    
    console.log('消毒カテゴリ判定:', hasDisinfection);
    
    if (hasDisinfection) {
        appliedPrice = kabiData.discountPrice; // 1000円
        console.log('消毒割引適用: 1000円');
        return appliedPrice * quantity;
    }

    // 第2条件: 基礎カテゴリまたはDC2/60を含む商品があれば1700円
    const hasDiscount2Condition = selectedProducts.some(product => {
        // 基礎カテゴリをチェック（新規工事または追加工事で基礎商品）
        if ((product.category === "新規工事" || product.category === "追加工事") && 
            (product.item && (product.item.includes("基礎") || product.item.includes("クラック")))) {
            console.log('基礎商品発見:', product);
            return true;
        }
        
        // DC2または60を含む商品をチェック
        if (product.item && (product.item.includes("DC2") || product.item.includes("60"))) {
            console.log('DC2/60商品発見:', product);
            return true;
        }
        
        return false;
    });
    
    console.log('第2条件判定:', hasDiscount2Condition);
    
    if (hasDiscount2Condition) {
        appliedPrice = kabiData.discount2Price; // 1700円
        console.log('第2条件割引適用: 1700円');
    } else {
        console.log('基本価格適用: 2500円');
    }

    const finalPrice = appliedPrice * quantity;
    console.log('最終価格:', finalPrice);
    console.log('=== カビ価格計算終了 ===');

    return finalPrice;
}


// 基礎セット値引きをチェックする関数
function checkKisoSetDiscount(selectedProducts) {
    const hasGaiKiso = selectedProducts.some(p => 
        p.category === "新規工事" && p.item.includes("外基礎"));
    const hasNakaKiso = selectedProducts.some(p => 
        p.category === "新規工事" && p.item.includes("中基礎"));
    
    return hasGaiKiso && hasNakaKiso;
}

// 入力ラベルを更新する関数
function updateInputLabel(category, item, lengthElement) {
    if (category === "クラック") {
        const label = lengthElement.previousElementSibling;
        if (label) {
            label.textContent = "数量(個):";
        }
        lengthElement.placeholder = "個数を入力";
        lengthElement.title = "クラックの個数を入力してください";
    } else {
        const label = lengthElement.previousElementSibling;
        if (label) {
            label.textContent = "長さ(m):";
        }
        lengthElement.placeholder = "";
        lengthElement.title = "";
    }
}

// カテゴリの選択肢を生成する関数
function populateCategories(products, selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    const currentValue = selectElement.value; // 現在の選択値を保存
    
    selectElement.innerHTML = '<option value="">項目選択</option>';

    const categories = Object.keys(products);
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        selectElement.appendChild(option);
    });

    // 以前の選択値があれば復元
    if (currentValue) {
        selectElement.value = currentValue;
    }
}


// サブカテゴリの選択肢を更新する関数
function updateSubCategory(products, mainCategoryId, subCategoryId) {
    const mainCategory = document.getElementById(mainCategoryId).value;
    const subCategory = document.getElementById(subCategoryId);
    
    subCategory.innerHTML = '<option value="">項目を選択してください</option>';

    if (mainCategory && products[mainCategory]) {
        const subOptions = Object.keys(products[mainCategory]);
        subOptions.forEach(option => {
            const newOption = document.createElement('option');
            newOption.value = option;
            newOption.textContent = option;
            subCategory.appendChild(newOption);
        });
    }
}

// 次の商品フォームを表示する関数
function showNextProduct(currentProductNum, productType = 'product') {
    const prefix = productType === 'product' ? '' : 'kiso-';
    const nextProduct = document.getElementById(`${prefix}product${currentProductNum + 1}`);
    if (nextProduct) {
        nextProduct.style.display = 'block';
    }
}

// 値引き計算を行う関数
function calculateDiscount(price, discountValue) {
    if (!discountValue || discountValue <= 0) return 0;
    
    if (discountValue < 100) {
        return Math.floor(price * (discountValue / 100));
    }
    return Math.min(discountValue, price);
}

function calculateProduct(productId, productType = 'product') {
    try {
        // フォーカス位置を保存（通常商品の場合）
        const shouldPreserveFocus = productType === 'product';
        let activeElement = null;
        let activeElementRect = null;
        let scrollY = 0;
        let scrollX = 0;
        
        if (shouldPreserveFocus) {
            activeElement = document.activeElement;
            scrollY = window.scrollY;
            scrollX = window.scrollX;
            if (activeElement && activeElement !== document.body) {
                activeElementRect = activeElement.getBoundingClientRect();
            }
        }
    
        const productNum = parseInt(productId.replace(/[^0-9]/g, ''));
        const prefix = productType === 'product' ? '' : 'kiso-';
        
        const goodsElement = document.getElementById(prefix + 'goods' + productNum);
        const listElement = document.getElementById((productType === 'product' ? 'list' : 'kiso-list') + productNum);
        
        if (!goodsElement || !listElement) {
            console.log('Required elements not found:', productId);
            return;
        }

        const category = goodsElement.value;
        const item = listElement.value;

        let priceExTax = 0;
        let priceInTax = 0;
        let kisoName = "";

        if (productType === 'kiso-product') {
            const heightElement = document.getElementById(`kiso-height${productNum}`);
            const lengthElement = document.getElementById(`kiso-length${productNum}`);
            const discountElement = document.getElementById(`kiso-discount_value${productNum}`);

            if (!heightElement || !lengthElement || !discountElement) {
                console.log('Required kiso elements not found:', productNum);
                return;
            }

            const height = heightElement.value;
            const length = parseFloat(lengthElement.value) || 0;
            const discountValue = parseFloat(discountElement.value) || 0;

            if (category && item && kisoProductsData[category] && kisoProductsData[category][item]) {
                const productData = kisoProductsData[category][item];
                if (productData && productData["高さ別価格"] && productData["高さ別価格"][height]) {
                    const heightData = productData["高さ別価格"][height];
                    let basePrice = heightData["基本価格"];
                    let lengthPrice = heightData["長さ加算"];

                    if (category === "クラック") {
                        // クラックの場合は長さを数量として扱う
                        basePrice = lengthPrice * length;
                    } else {
                        // 通常の基礎商品の場合
                        const basicLength = productData["基本長さ"] || 20;
                        if (length > basicLength) {
                            const extraLength = length - basicLength;
                            basePrice += extraLength * lengthPrice;
                        }
                    }

                    const discount = calculateDiscount(basePrice, discountValue);
                    priceExTax = basePrice - discount;

                    priceInTax = Math.floor(priceExTax * 1.1);
                    kisoName = category === "クラック" 
                        ? `${item} ${height}cm ${length}個`
                        : `${item} ${height}cm ${length}m`;
                }
            }
        } else {
            const quantityElement = document.getElementById('quantity' + productNum);
            const discountElement = document.getElementById('discount_value' + productNum);

            if (!quantityElement || !discountElement) {
                console.log('Required product elements not found:', productNum);
                return;
            }

            if (category && item && productsData[category] && productsData[category][item]) {
                const productData = productsData[category][item];
                const quantity = parseFloat(quantityElement.value) || 0;
                const discountValue = parseFloat(discountElement.value) || 0;

                if ((category === "そのほか" && item === "カビ") || 
                    (category === "消毒" && item === "カビ")) {
                    // 現在の商品も含めて判定する
                    const currentProduct = { category, item, quantity };
                    const allProducts = [...selectedProducts, currentProduct];
                    priceExTax = calculateKabiPrice(quantity, allProducts);
                } else if (category === "そのほか" && item === "BM") {
                    priceExTax = calculateBMPrice(quantity, selectedProducts);
                } else if (category === "床下機器" && item === "SO2買") {
                    // 他の選択商品をチェック
                    const hasSpecialDiscount = selectedProducts.some(product => 
                        product.item && (product.item.includes("DC2") || product.item.includes("60"))
                    );

                    // 特別割引価格または通常価格を適用
                    const unitPrice = hasSpecialDiscount ? 83000 : productData.price;
                    priceExTax = unitPrice * quantity;
                } else {
                    let totalPrice = productData.base || 0;

                    if (productData.areaThreshold) {
                        if (quantity > productData.areaThreshold) {
                            totalPrice += productData.price * (quantity - productData.areaThreshold);
                        }
                    } else {
                        totalPrice += productData.price * quantity;
                    }
                    priceExTax = totalPrice;
                }

                const discount = calculateDiscount(priceExTax, discountValue);
                priceExTax -= discount;
                priceInTax = Math.floor(priceExTax * 1.1);
            }
        }

        const priceExTaxElement = document.getElementById(prefix + 'price_ex_tax' + productNum);
        const priceInTaxElement = document.getElementById(prefix + 'price_in_tax' + productNum);

        if (priceExTaxElement) priceExTaxElement.innerText = formatNumber(priceExTax);
        if (priceInTaxElement) priceInTaxElement.innerText = formatNumber(priceInTax);

        if (priceExTax > 0) {
            updateSelectedProducts(productId, category, item, kisoName, priceExTax, priceInTax);
        }
        
        // フォーカス位置を復元（通常商品の場合）
        if (shouldPreserveFocus) {
            setTimeout(() => {
                if (activeElement && activeElement !== document.body && document.contains(activeElement)) {
                    try {
                        activeElement.focus();
                        
                        // 元の要素の位置を維持するためにスクロール調整
                        if (activeElementRect) {
                            const newRect = activeElement.getBoundingClientRect();
                            const deltaY = newRect.top - activeElementRect.top;
                            const deltaX = newRect.left - activeElementRect.left;
                            
                            if (Math.abs(deltaY) > 1 || Math.abs(deltaX) > 1) {
                                window.scrollTo(scrollX - deltaX, scrollY - deltaY);
                            }
                        }
                    } catch (e) {
                        // フォーカス復元に失敗した場合は、スクロール位置のみ復元
                        window.scrollTo(scrollX, scrollY);
                    }
                } else {
                    // アクティブ要素がない場合は、スクロール位置のみ復元
                    window.scrollTo(scrollX, scrollY);
                }
            }, 10); // updateSummaryより少し遅らせる
        }

    } catch (error) {
        console.error("calculateProductでエラーが発生しました:", error);
    }
}


function setupEventListeners(i, productType = 'product') {
    const prefix = productType === 'product' ? '' : 'kiso-';
    const elements = {
        goods: document.getElementById(`${prefix}goods${i}`),
        list: document.getElementById(`${prefix}list${i}`),
        height: document.getElementById(`${prefix}height${i}`),
        length: document.getElementById(`${prefix}length${i}`),
        discount: document.getElementById(`${prefix}discount_value${i}`),
        quantity: document.getElementById(`quantity${i}`)
    };

    let productsDataToUse = (productType === 'product') ? productsData : kisoProductsData;
    if (elements.goods) {
        populateCategories(productsDataToUse, `${prefix}goods${i}`);
        elements.goods.addEventListener('change', () => {
            updateSubCategory(productsDataToUse, `${prefix}goods${i}`, `${prefix}list${i}`);
            
            if (productType === 'kiso-product') {
                const lengthElement = document.getElementById(`kiso-length${i}`);
                if (lengthElement) {
                    updateInputLabel(elements.goods.value, null, lengthElement);
                }
            }
            
            calculateProduct(`${prefix}product${i}`, productType);
        });
    }

    if (elements.list) {
        elements.list.addEventListener('change', () => {
            calculateProduct(`${prefix}product${i}`, productType);
            const nextProductNum = i + 1;
            const nextProduct = document.getElementById(`${prefix}product${nextProductNum}`);
            
            if (nextProduct) {
                nextProduct.style.display = 'block';
                
                const currentGoodsElement = document.getElementById(`${prefix}goods${i}`);
                const nextGoodsElement = document.getElementById(`${prefix}goods${nextProductNum}`);
                
                if (currentGoodsElement && nextGoodsElement) {
                    const selectedCategory = currentGoodsElement.value;
                    
                    // 次の商品の大項目を設定して表示を更新
                    nextGoodsElement.value = selectedCategory;
                    populateCategories(productsDataToUse, `${prefix}goods${nextProductNum}`);
                    nextGoodsElement.value = selectedCategory; // 再度値を設定
    
                    if (selectedCategory) {
                        // 小項目の選択肢を更新
                        updateSubCategory(
                            productType === 'product' ? productsData : kisoProductsData,
                            `${prefix}goods${nextProductNum}`,
                            `${prefix}list${nextProductNum}`
                        );
    
                        if (productType === 'kiso-product' && selectedCategory === 'クラック') {
                            const nextLengthElement = document.getElementById(`kiso-length${nextProductNum}`);
                            if (nextLengthElement) {
                                updateInputLabel(selectedCategory, null, nextLengthElement);
                            }
                        }
                    }
                }
                
                setupEventListeners(nextProductNum, productType);
            }
        });
    }
    

    function setupNumberInput(element) {
        if (element) {
            element.addEventListener('input', () => {
                calculateProduct(`${prefix}product${i}`, productType);
            });
        }
    }

    if (productType === 'kiso-product') {
        setupNumberInput(elements.height);
        setupNumberInput(elements.length);
        setupNumberInput(elements.discount);
    } else {
        setupNumberInput(elements.quantity);
        setupNumberInput(elements.discount);
    }
}

function updateSelectedProducts(productId, category, item, kisoName, priceExTax, priceInTax) {
    const productNum = parseInt(productId.replace(/[^0-9]/g, ''));
    const isKiso = productId.includes('kiso');
    const quantity = isKiso ? 1 : (parseFloat(document.getElementById('quantity' + productNum).value) || 0);
    const discount = parseFloat(document.getElementById((isKiso ? 'kiso-' : '') + 'discount_value' + productNum).value) || 0;

    const discountText = discount > 0 
        ? (discount < 100 ? `${discount}%` : `${formatNumber(discount)}円`)
        : '0円';

    const newProduct = {
        productId: productId,
        category: category,
        item: isKiso ? kisoName : item,
        quantity: quantity,
        discountValue: discount,
        discountText: discountText,
        priceExTax: priceExTax,
        priceInTax: priceInTax
    };

    const existingIndex = selectedProducts.findIndex(p => p.productId === productId);
    if (existingIndex !== -1) {
        selectedProducts[existingIndex] = newProduct;
    } else {
        selectedProducts.push(newProduct);
    }

    updateSummary();
}

function updateSummary() {
    const summaryList = document.getElementById('summary-list');
    if (!summaryList) return;
    
    // 現在のフォーカス要素とスクロール位置を保存
    const activeElement = document.activeElement;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    // アクティブ要素の位置を相対的に記録
    let activeElementRect = null;
    if (activeElement && activeElement !== document.body) {
        activeElementRect = activeElement.getBoundingClientRect();
    }
    
    summaryList.innerHTML = '';
    
    // 初回プレースホルダーを削除（既にinnerHTMLでクリアされているが、明示的に処理）
    const placeholder = summaryList.querySelector('.summary-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
    
    // 商品がない場合も3つのグループを表示
    const validProducts = selectedProducts.filter(product => product.priceExTax > 0);
    if (validProducts.length === 0) {
        // 商品グループ
        const productGroup = document.createElement('li');
        productGroup.className = 'summary-group';
        productGroup.innerHTML = `
            <div class="summary-label">商品：</div>
            <div class="summary-content" style="color: #94a3b8;">未選択</div>
            <button class="copy-button" data-copy="">コピー</button>
        `;
        summaryList.appendChild(productGroup);
        // 数量グループ
        const quantityGroup = document.createElement('li');
        quantityGroup.className = 'summary-group';
        quantityGroup.innerHTML = `
            <div class="summary-label">数量：</div>
            <div class="summary-content" style="color: #94a3b8;">0</div>
            <button class="copy-button" data-copy="0">コピー</button>
        `;
        summaryList.appendChild(quantityGroup);
        // 合計金額グループ
        const totalGroup = document.createElement('li');
        totalGroup.className = 'summary-group';
        totalGroup.innerHTML = `
            <div class="summary-label">合計金額(抜)：</div>
            <div class="summary-content" style="color: #94a3b8;">0円</div>
            <button class="copy-button" data-copy="0">コピー</button>
        `;
        summaryList.appendChild(totalGroup);
        return;
    }
    
    // 基礎セット割引の通知
    if (checkKisoSetDiscount(selectedProducts)) {
        const setDiscountNotice = document.createElement('li');
        setDiscountNotice.className = 'summary-notice';
        setDiscountNotice.textContent = '※ 外基礎・中基礎セット値引き 40,000円 適用中';
        summaryList.appendChild(setDiscountNotice);
    }

    const productGroup = document.createElement('li');
    productGroup.className = 'summary-group';
    const productNames = validProducts.map(p => {
        let productName = '';
        if (p.productId.includes('kiso-')) {
            const fullName = p.item;
            // クラック商品の場合は商品名のみを抽出
            if (fullName.includes('クラック')) {
                const match = fullName.match(/(外クラック|中片クラック|中両面クラック)/);
                productName = match ? match[0] : fullName.split(' ')[0];
            } else {
                // 基礎商品の場合
                const match = fullName.match(/(外基礎|中基礎)/);
                if (match) {
                    productName = match[0];
                    // 追加工事の場合は「追」を追加
                    if (p.category === '追加工事') {
                        productName += '追';
                    }
                } else {
                    productName = fullName;
                }
            }
        } else {
            productName = p.item;
        }
        
        // 値引きがある場合は▲値引き額を追加
        if (p.discountValue && p.discountValue > 0) {
            if (p.discountValue < 100) {
                productName += `▲${p.discountValue}%`;
            } else {
                productName += `▲${formatNumber(p.discountValue)}`;
            }
        }
        
        return productName;
    }).join('・');

    // 基礎セット値引きがある場合は特別表記に変更
    let finalProductNames = productNames;
    if (checkKisoSetDiscount(selectedProducts)) {
        // 外基礎・中基礎を抽出して()で囲む
        const kisoProducts = validProducts.filter(p => 
            p.productId.includes('kiso-') && 
            (p.item.includes('外基礎') || p.item.includes('中基礎'))
        );
        const kisoNames = kisoProducts.map(p => {
            const match = p.item.match(/(外基礎|中基礎)/);
            if (match) {
                let productName = match[0];
                // 追加工事の場合は「追」を追加
                if (p.category === '追加工事') {
                    productName += '追';
                }
                return productName;
            } else {
                return p.item;
            }
        });
        
        // 外基礎・中基礎以外の商品
        const otherProducts = validProducts.filter(p => 
            !p.productId.includes('kiso-') || 
            (!p.item.includes('外基礎') && !p.item.includes('中基礎'))
        );
        const otherNames = otherProducts.map(p => {
            let productName = '';
            if (p.productId.includes('kiso-')) {
                const fullName = p.item;
                // クラック商品の場合は商品名のみを抽出
                if (fullName.includes('クラック')) {
                    const match = fullName.match(/(外クラック|中片クラック|中両面クラック)/);
                    productName = match ? match[0] : fullName.split(' ')[0];
                } else {
                    // 基礎商品の場合
                    const match = fullName.match(/(外基礎|中基礎)/);
                    if (match) {
                        productName = match[0];
                        // 追加工事の場合は「追」を追加
                        if (p.category === '追加工事') {
                            productName += '追';
                        }
                    } else {
                        productName = fullName;
                    }
                }
            } else {
                productName = p.item;
            }
            
            // 値引きがある場合は▲値引き額を追加
            if (p.discountValue && p.discountValue > 0) {
                if (p.discountValue < 100) {
                    productName += `▲${p.discountValue}%`;
                } else {
                    productName += `▲${formatNumber(p.discountValue)}`;
                }
            }
            
            return productName;
        });
        
        // (外基礎・中基礎)▲セット の形式で表記
        const kisoSetName = `(${kisoNames.join('・')})▲セット`;
        const allNames = otherNames.length > 0 ? [kisoSetName, ...otherNames] : [kisoSetName];
        finalProductNames = allNames.join('・');
    }

    // 一般管理費がチェックされている場合は「管有」を追加
    const managementFeeChecked = document.getElementById('management-fee-switch').checked;
    if (managementFeeChecked) {
        finalProductNames += '・管有';
    }

    productGroup.innerHTML = `
        <div class="summary-label">商品：</div>
        <div class="summary-content">${finalProductNames}</div>
        <button class="copy-button" data-copy="${finalProductNames}">コピー</button>
    `;
    summaryList.appendChild(productGroup);

    // 数量のグループ
    const quantityGroup = document.createElement('li');
    quantityGroup.className = 'summary-group';
    const quantities = validProducts.map(p => {
        if (p.productId.includes('kiso-')) {
            const productNum = p.productId.replace(/[^0-9]/g, '');
            const heightElement = document.getElementById(`kiso-height${productNum}`);
            const lengthElement = document.getElementById(`kiso-length${productNum}`);
            
            if (heightElement && lengthElement) {
                const height = heightElement.value;
                const length = lengthElement.value;
                return `${height}*${length}m`;
            }
            return p.quantity;
        }
        return p.quantity;
    }).join('/');

    quantityGroup.innerHTML = `
        <div class="summary-label">数量：</div>
        <div class="summary-content">${quantities}</div>
        <button class="copy-button" data-copy="${quantities}">コピー</button>
    `;
    summaryList.appendChild(quantityGroup);

    // 合計金額のグループ
    let totalExTax = validProducts.reduce((sum, p) => sum + p.priceExTax, 0);
    
    // 基礎セット値引きを適用
    if (checkKisoSetDiscount(selectedProducts)) {
        totalExTax -= 40000;
    }
    
    if (document.getElementById('management-fee-switch').checked) {
        totalExTax += 20000;
    }
    const totalGroup = document.createElement('li');
    totalGroup.className = 'summary-group';
    const formattedTotal = formatNumber(totalExTax);
    totalGroup.innerHTML = `
        <div class="summary-label">合計金額(抜)：</div>
        <div class="summary-content">${formattedTotal}円</div>
        <button class="copy-button" data-copy="${formattedTotal}">コピー</button>
    `;
    summaryList.appendChild(totalGroup);

    // コピーボタンのイベントリスナーを設定
    document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', function() {
            const textToCopy = this.getAttribute('data-copy');
            navigator.clipboard.writeText(textToCopy).then(() => {
                // コピー成功時の視覚的フィードバック
                this.textContent = 'コピー完了';
                setTimeout(() => {
                    this.textContent = 'コピー';
                }, 2000);
            });
        });
    });

    // 既存の合計金額更新処理
    const totalExTaxElement = document.getElementById('total-ex-tax');
    const totalInTaxElement = document.getElementById('total-in-tax');
    let finalTotalExTax = validProducts.reduce((sum, p) => sum + p.priceExTax, 0);
    let finalTotalInTax = validProducts.reduce((sum, p) => sum + p.priceInTax, 0);
    
    // 基礎セット値引きを適用
    if (checkKisoSetDiscount(selectedProducts)) {
        finalTotalExTax -= 40000;
        finalTotalInTax -= 40000;
    }
    
    if (document.getElementById('management-fee-switch').checked) {
        finalTotalExTax += 20000;
        finalTotalInTax += 22000;
    }
    
    if (totalExTaxElement) totalExTaxElement.textContent = formatNumber(finalTotalExTax);
    if (totalInTaxElement) totalInTaxElement.textContent = formatNumber(finalTotalInTax);
    
    // フォーカスと画面位置を復元
    setTimeout(() => {
        // フォーカスを復元
        if (activeElement && activeElement !== document.body && document.contains(activeElement)) {
            try {
                activeElement.focus();
                
                // 元の要素の位置を維持するためにスクロール調整
                if (activeElementRect) {
                    const newRect = activeElement.getBoundingClientRect();
                    const deltaY = newRect.top - activeElementRect.top;
                    const deltaX = newRect.left - activeElementRect.left;
                    
                    if (Math.abs(deltaY) > 1 || Math.abs(deltaX) > 1) {
                        window.scrollTo(scrollX - deltaX, scrollY - deltaY);
                    }
                }
            } catch (e) {
                // フォーカス復元に失敗した場合は、スクロール位置のみ復元
                window.scrollTo(scrollX, scrollY);
            }
        } else {
            // アクティブ要素がない場合は、スクロール位置のみ復元
            window.scrollTo(scrollX, scrollY);
        }
    }, 0);
}


function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const tabId = button.dataset.tab;
            const activeContent = document.getElementById(tabId);
            if (activeContent) {
                activeContent.classList.add('active');
            }

            if (tabId === 'kiso-products') {
                // 基礎商品の表示制御
                let shouldShowNext = true;
                for (let i = 1; i <= 4; i++) {
                    const kisoProduct = document.getElementById('kiso-product' + i);
                    if (kisoProduct) {
                        const hasProduct = selectedProducts.some(p => p.productId === `kiso-product${i}`);
                        
                        // 最初の商品か、選択済み商品か、前の商品が表示されている場合に表示
                        if (i === 1 || hasProduct || shouldShowNext) {
                            kisoProduct.style.display = 'block';
                            // 商品が選択されているか、入力中の場合は次の商品も表示
                            const kisoGoodsElement = document.getElementById(`kiso-goods${i}`);
                            shouldShowNext = hasProduct || (kisoGoodsElement && kisoGoodsElement.value);
                        } else {
                            kisoProduct.style.display = 'none';
                        }
                    }
                }

                // 通常商品は非表示
                for (let i = 1; i <= 6; i++) {
                    const product = document.getElementById('product' + i);
                    if (product) {
                        product.style.display = 'none';
                    }
                }
            } else {
                // 通常商品の表示制御
                let shouldShowNext = true;
                for (let i = 1; i <= 6; i++) {
                    const product = document.getElementById('product' + i);
                    if (product) {
                        const hasProduct = selectedProducts.some(p => p.productId === `product${i}`);
                        
                        // 最初の商品か、選択済み商品か、前の商品が表示されている場合に表示
                        if (i === 1 || hasProduct || shouldShowNext) {
                            product.style.display = 'block';
                            // 商品が選択されているか、入力中の場合は次の商品も表示
                            const goodsElement = document.getElementById(`goods${i}`);
                            shouldShowNext = hasProduct || (goodsElement && goodsElement.value);
                        } else {
                            product.style.display = 'none';
                        }
                    }
                }

                // 基礎商品は非表示
                for (let i = 1; i <= 4; i++) {
                    const kisoProduct = document.getElementById('kiso-product' + i);
                    if (kisoProduct) {
                        kisoProduct.style.display = 'none';
                    }
                }
            }
        });
    });
}



// 初期化処理
window.onload = function() {
    try {
        // 初回スクロール問題を防ぐため、サマリーを先に初期化
        const summaryList = document.getElementById('summary-list');
        if (summaryList && summaryList.children.length === 0) {
            // 空のサマリーリストに最小コンテンツを追加して高さを確保
            const placeholder = document.createElement('li');
            placeholder.className = 'summary-placeholder';
            placeholder.style.visibility = 'hidden';
            placeholder.style.height = '60px';
            summaryList.appendChild(placeholder);
        }
        
        setupTabs();
        setupEventListeners(1, "product");
        setupEventListeners(1, "kiso-product");

        const calculateButton = document.getElementById('calculate-button');
        if(calculateButton) {
            calculateButton.addEventListener('click', function() {
                selectedProducts.forEach(product => {
                    const productNum = parseInt(product.productId.replace(/[^0-9]/g, ''));
                    const isKiso = product.productId.includes('kiso');
                    calculateProduct(product.productId, isKiso ? 'kiso-product' : 'product');
                });
                updateSummary();
            });
        }
        
        const managementFeeCheckbox = document.getElementById('management-fee-switch');
        if(managementFeeCheckbox) {
            managementFeeCheckbox.addEventListener('change', updateSummary);
        }

        const resetButton = document.getElementById('reset-button');
        if(resetButton) {
            resetButton.addEventListener('click', function() {
                selectedProducts = [];
                resetForms();
                updateSummary();
            });
        }

        hideInitialProducts();

        // 初期状態でsummaryエリアを更新して、適切な初期表示を確保
        updateSummary();

    } catch (error) {
        console.error("初期化エラー:", error);
        alert("ページの初期化に失敗しました。");
    }

    // 商品フォーム追加ボタンの処理
const addProductButton = document.getElementById('add-product-button');
if(addProductButton) {
    addProductButton.addEventListener('click', function() {
        const activeTab = document.querySelector('.tab-button.active');
        const isKisoTab = activeTab.dataset.tab === 'kiso-products';
        
        if (isKisoTab) {
            // 基礎商品の追加
            for (let i = 1; i <= 4; i++) {
                const kisoProduct = document.getElementById('kiso-product' + i);
                if (kisoProduct && kisoProduct.style.display === 'none') {
                    kisoProduct.style.display = 'block';
                    setupEventListeners(i, 'kiso-product');
                    break;
                }
            }
        } else {
            // 通常商品の追加
            for (let i = 1; i <= 6; i++) {
                const product = document.getElementById('product' + i);
                if (product && product.style.display === 'none') {
                    product.style.display = 'block';
                    setupEventListeners(i, 'product');
                    break;
                }
            }
        }
    });
}

};

function resetForms() {
    // 通常商品のリセット
    for (let i = 1; i <= 6; i++) {
        resetProductForm(i, false);
        const product = document.getElementById('product' + i);
        if (product) {
            product.style.display = i === 1 ? 'block' : 'none';
        }
    }
    
    // 基礎商品のリセット
    for (let i = 1; i <= 4; i++) {
        resetProductForm(i, true);
        const kisoProduct = document.getElementById('kiso-product' + i);
        if (kisoProduct) {
            kisoProduct.style.display = 'none';
        }
    }

    // タブの状態をリセット
    const productTab = document.querySelector('.tab-button[data-tab="products"]');
    const kisoTab = document.querySelector('.tab-button[data-tab="kiso-products"]');
    const productContent = document.getElementById('products');
    const kisoContent = document.getElementById('kiso-products');

    if (productTab && kisoTab && productContent && kisoContent) {
        productTab.classList.add('active');
        kisoTab.classList.remove('active');
        productContent.classList.add('active');
        kisoContent.classList.remove('active');
    }

    // 合計金額をリセット
    const totalExTaxElement = document.getElementById('total-ex-tax');
    const totalInTaxElement = document.getElementById('total-in-tax');
    if (totalExTaxElement) totalExTaxElement.textContent = '0';
    if (totalInTaxElement) totalInTaxElement.textContent = '0';

    // 一般管理費のチェックボックスをリセット
    const managementFeeCheckbox = document.getElementById('management-fee-switch');
    if (managementFeeCheckbox) {
        managementFeeCheckbox.checked = false;
    }

    // イベントリスナーを再設定
    setupEventListeners(1, "product");
    setupEventListeners(1, "kiso-product");
}

function resetProductForm(index, isKiso) {
    const prefix = isKiso ? 'kiso-' : '';
    const elements = {
        goods: document.getElementById(`${prefix}goods${index}`),
        list: document.getElementById(`${prefix}list${index}`),
        quantity: document.getElementById(`${prefix}quantity${index}`),
        height: document.getElementById(`${prefix}height${index}`),
        length: document.getElementById(`${prefix}length${index}`),
        discount: document.getElementById(`${prefix}discount_value${index}`),
        priceExTax: document.getElementById(`${prefix}price_ex_tax${index}`),
        priceInTax: document.getElementById(`${prefix}price_in_tax${index}`)
    };

    Object.values(elements).forEach(element => {
        if (element) {
            if (element.tagName === 'SELECT') {
                element.selectedIndex = 0;
            } else if (element.tagName === 'INPUT') {
                element.value = '0';
            } else if (element.tagName === 'SPAN') {
                element.innerText = '0';
            }
        }
    });

    if (elements.list) {
        elements.list.innerHTML = '<option value="">項目を選択してください</option>';
    }

    if (isKiso) {
        const lengthElement = document.getElementById(`kiso-length${index}`);
        if (lengthElement) {
            const label = lengthElement.previousElementSibling;
            if (label) {
                label.textContent = "長さ(m):";
            }
            lengthElement.placeholder = "";
            lengthElement.title = "";
        }
    }
}

function hideInitialProducts() {
    for (let i = 2; i <= 6; i++) {
        const product = document.getElementById('product' + i);
        if(product) {
            product.style.display = 'none';
        }
    }
    for (let i = 2; i <= 4; i++) {
        const kisoProduct = document.getElementById('kiso-product' + i);
        if(kisoProduct) {
            kisoProduct.style.display = 'none';
        }
    }
    const kisoProduct1 = document.getElementById('kiso-product1');
    if (kisoProduct1) {
        kisoProduct1.style.display = 'none';
    }
}

// 追加のイベントリスナー設定
for (let i = 1; i <= 6; i++) {
    setupEventListeners(i, 'product');
}
for (let i = 1; i <= 4; i++) {
    setupEventListeners(i, 'kiso-product');
}

// BMの価格を計算する関数
function calculateBMPrice(quantity, selectedProducts) {
    const bmData = productsData["そのほか"]["BM"];
    let appliedPrice = bmData.price; // 基本価格 3,300円

    // 既存の割引条件チェック
    const hasExistingDiscount = selectedProducts.some(product => {
        // カテゴリによる判定
        if (bmData.discountConditions.some(condition => 
            condition.type === "category" && condition.value === product.category)) {
            return true;
        }
        // 商品名による判定
        if (bmData.discountConditions.some(condition => 
            condition.type === "item" && condition.value === product.item)) {
            return true;
        }
        return false;
    });

    // 基礎工事との同時選択チェック（新規追加の条件）
    const hasKiso = selectedProducts.some(product => 
        (product.item && (product.item.includes("外基礎") || product.item.includes("中基礎")))
    );

    // いずれかの条件に該当する場合、割引価格を適用
    if (hasExistingDiscount || hasKiso) {
        appliedPrice = bmData.discountPrice; // 割引価格 2,800円
    }

    return appliedPrice * quantity;
}


