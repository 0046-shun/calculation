// アラート機能専用JavaScriptファイル
// alert-functions.js

/**
 * 商品組み合わせルールの定義
 * 新しいルールを追加する場合は、この配列に追加するだけ
 */
const PRODUCT_RULES = [
    {
        name: '駆除とカビの同時契約禁止',
        message: '駆除とカビの同時契約は禁止です',
        icon: '❌',
        type: 'error',
        combinations: [
            { category: '消毒', item: 'ｲｴ駆除' },
            { category: 'そのほか', item: 'カビ' }
        ]
    },
    {
        name: '床断熱とカビの平米比率確認',
        message: '断熱材とカビの平米比率を確認してください',
        icon: '⚠️',
        type: 'warning',
        combinations: [
            { category: '断熱遮熱', item: '床断熱' },
            { category: 'そのほか', item: 'カビ' }
        ]
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
