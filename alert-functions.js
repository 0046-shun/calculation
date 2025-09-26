// アラート機能専用JavaScriptファイル
// alert-functions.js

/**
 * 商品組み合わせルールの定義
 * 新しいルールを追加する場合は、この配列に追加するだけ
 */
//アイコン種類 ℹ️ ⚠️ ❌　📢　✔️　💡
const PRODUCT_RULES = [
    {
        name: 'そのほかカビと駆除の同時契約禁止',
        message: '駆除とカビの同時契約は禁止です',
        icon: '❌',
        type: 'error',
        mainItem: { category: 'そのほか', item: 'カビ' }, // メインアイテム
        secondaryItems: [ // 候補アイテム（複数可）
            { category: '消毒', item: 'ｲｴ駆除' },
            { category: '消毒', item: 'ﾔ駆除' }
        ]
    },
    {
        name: '消毒カビと駆除の同時契約禁止',
        message: '駆除とカビの同時契約は禁止です',
        icon: '❌',
        type: 'error',
        mainItem: { category: '消毒', item: 'カビ' }, // メインアイテム
        secondaryItems: [ // 候補アイテム（複数可）
            { category: '消毒', item: 'ｲｴ駆除' },
            { category: '消毒', item: 'ﾔ駆除' }
        ]
    },
    {
        name: '過料販売規制',
        message: '過料販売ルールに則っていますか？',
        icon: '⚠️',
        type: 'warning',
        mainItem: { category: 'そのほか', item: '家屋補強' }, // メインアイテム
        secondaryItems: [ // 候補アイテム（複数可）
            { category: '新規工事', item: '外基礎' },
            { category: '新規工事', item: '中基礎' },
            { category: '追加工事', item: '外基礎追' },
            { category: '追加工事', item: '中基礎追' },
            { category: '追加工事', item: '外クラ' },
            { category: '追加工事', item: '中片クラ' },
            { category: '追加工事', item: '中両クラ' },
            { category: '基礎関連', item: '基礎化粧' },
            { category: '基礎関連', item: 'アンカー' },
            { category: '基礎関連', item: '増し打ち' },
            { category: '基礎関連', item: '表面補修' },
            { category: '基礎関連', item: '人通口開口' },
            { category: '基礎関連', item: '人通口拡張' }
        ]
    },
    {
        name: 'カビの確認事項',
        message: '1年以内にカビ及び駆除はないですか？',
        icon: '⚠️',
        type: 'warning',
        combinations: [
            { category: 'そのほか', item: 'カビ' },
            { category: '消毒', item: 'カビ' }
        ],
        singleItem: true  // 単品でも反応するフラグ
    },
    {
        name: 'ベイト確認時の注意事項',
        message: '消毒平米と同じですか？',
        icon: '⚠️',
        type: 'warning',
        combinations: [
            { category: '消毒', item: 'ベイト新' },
            { category: '消毒', item: 'ベイト継' }
        ],
        singleItem: true  // 単品でも反応するフラグ
    },
    {
        name: '保証期間確認',
        message: '保証が切れて５年以内ですか？',
        icon: '⚠️',
        type: 'warning',
        combinations: [
            { category: '消毒', item: '切予防' },
        ],
        singleItem: true  // 単品でも反応するフラグ
    },
    {
        name: '床断熱とカビの平米比率確認',
        message: '断熱とカビの比率を確認してください',
        icon: '⚠️',
        type: 'warning',
        mainItem: { category: '断熱遮熱', item: '床断熱' },
        secondaryItems: [
            { category: 'そのほか', item: 'カビ' },
            { category: '消毒', item: 'カビ'}
        ]
    },
    {
        name: '床断熱追の過去履歴',
        message: '過去の履歴に床下断熱がありますか？',
        icon: '⚠️',
        type: 'warning',
        combinations: [
            { category: '断熱遮熱', item: '床断熱追' },
        ],
        singleItem: true  // 単品でも反応するフラグ
    },
    {
        name: 'ブレスマット確認',
        message: '消毒平米に対しBM枚数は適正ですか？',
        icon: '⚠️',
        type: 'warning',
        combinations: [
            { category: 'そのほか', item: 'BM' },
        ],
        singleItem: true  // 単品でも反応するフラグ
    }

    // 新しいルールを追加する場合は、ここに追加
];

/**
 * 指定されたルールの組み合わせが同時選択されているかチェック
 * @param {Object} rule - チェックするルール
 * @returns {boolean} 制限に引っかかった場合はtrue、そうでなければfalse
 */
function checkProductRule(rule) {
    if (typeof selectedProducts === 'undefined') return false;
    
    // ルールの組み合わせが全て選択されているかチェック
    const selectedItems = selectedProducts.map(p => ({ category: p.category, item: p.item }));
    
    // mainItem + secondaryItems の構造の場合
    if (rule.mainItem && rule.secondaryItems) {
        // メインアイテムが選択されているかチェック
        const hasMainItem = selectedItems.some(selected => 
            selected.category === rule.mainItem.category && 
            selected.item === rule.mainItem.item
        );
        
        // 候補アイテムのいずれかが選択されているかチェック
        const hasSecondaryItem = rule.secondaryItems.some(secondaryItem => 
            selectedItems.some(selected => 
                selected.category === secondaryItem.category && 
                selected.item === secondaryItem.item
            )
        );
        
        // メインアイテム + 候補アイテムのいずれかが選択されている場合に反応
        return hasMainItem && hasSecondaryItem;
    }
    
    // singleItem: true の場合は、いずれかの条件に一致すれば反応
    if (rule.singleItem) {
        return rule.combinations.some(combination => 
            selectedItems.some(selected => 
                selected.category === combination.category && 
                selected.item === combination.item
            )
        );
    }
    
    // 通常の場合は、全ての条件が揃った時のみ反応
    return rule.combinations.every(combination => 
        selectedItems.some(selected => 
            selected.category === combination.category && 
            selected.item === combination.item
        )
    );
}

/**
 * 商品選択時のアラートを積み重ねて表示する関数
 */
function showProductAlerts() {
    const alertElement = document.getElementById('alert-message');
    if (!alertElement) return;
    
    const alerts = [];
    
    // 全てのルールをチェック
    PRODUCT_RULES.forEach(rule => {
        if (checkProductRule(rule)) {
            alerts.push({
                message: rule.message,
                icon: rule.icon,
                type: rule.type
            });
        }
    });
    
    // アラート表示
    const iconElement = alertElement.querySelector('.alert-icon');
    const titleElement = alertElement.querySelector('.alert-title');
    const textElement = alertElement.querySelector('.alert-text');
    
    if (alerts.length === 0) {
        // デフォルトメッセージ
        alertElement.style.background = 'var(--primary-50)';
        alertElement.style.color = 'var(--primary-700)';
        alertElement.style.borderColor = 'var(--primary-200)';
        iconElement.textContent = 'ℹ️';
        titleElement.textContent = '商品選択時の注意事項';
        textElement.textContent = '商品を選択すると、ここに注意事項が表示されます。';
        titleElement.style.color = 'var(--primary-800)';
        textElement.style.color = 'var(--primary-600)';
    } else {
        // アラートメッセージ（エラー優先）
        const hasError = alerts.some(alert => alert.type === 'error');
        
        if (hasError) {
            alertElement.style.background = 'var(--danger-50)';
            alertElement.style.color = 'var(--danger-700)';
            alertElement.style.borderColor = 'var(--danger-200)';
            titleElement.style.color = 'var(--danger-800)';
            textElement.style.color = 'var(--danger-600)';
        } else {
            alertElement.style.background = 'var(--accent-50)';
            alertElement.style.color = 'var(--accent-700)';
            alertElement.style.borderColor = 'var(--accent-200)';
            titleElement.style.color = 'var(--accent-800)';
            textElement.style.color = 'var(--accent-600)';
        }
        
        titleElement.textContent = alerts.length > 1 ? `複数の注意事項 (${alerts.length}件)` : '注意事項';
        textElement.textContent = alerts.map(alert => `${alert.icon} ${alert.message}`).join('\n');
        textElement.style.whiteSpace = 'pre-line';
        textElement.style.fontSize = '1.1em';
        textElement.style.fontWeight = '500';
        
        // メインアイコンを非表示
        iconElement.textContent = '';
    }
    
    alertElement.style.display = 'flex';
}

/**
 * 商品選択時の全体的なチェック関数
 */
function checkProductSelectionRules() {
    showProductAlerts();
}
