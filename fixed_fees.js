// 固定額オプション定義
// 商品リストとは別に、チェックボックスで税抜合計へ固定額を加算するオプション。
// 追加・変更はこの配列を編集するだけでよい。
//   id             : チェックボックスID等に使う一意な識別子（"<id>-checkbox" が実際のDOM ID）
//   label          : 画面に表示する名称
//   token          : Excel連携時に商品名リストへ追加する短縮トークン（逆計算チェックの判定にも使用）
//   amount         : 税抜の加算額（円）
//   defaultChecked : 初期状態でチェックを入れるか
//   isProduct      : data.js / Firestore の商品マスタにも同名商品が存在するか
//                    （true の場合、逆計算チェックでは商品マスタ経由で計算される）
//   category       : 逆計算チェックの表示に使うカテゴリ名
(function (global) {
  var OPTIONS = [
    { id: 'management-fee', label: '一般管理費', token: '管有',  amount: 20000, defaultChecked: true,  isProduct: false, category: '管理費' },
    { id: 'island-sp-1',    label: '島特1',      token: '島特1', amount: 30000, defaultChecked: false, isProduct: true,  category: 'そのほか' },
    { id: 'island-1',       label: '離島1',      token: '離島1', amount: 20000, defaultChecked: false, isProduct: true,  category: 'そのほか' },
    { id: 'island-2',       label: '離島2',      token: '離島2', amount: 20000, defaultChecked: false, isProduct: true,  category: 'そのほか' },
    { id: 'island-3',       label: '離島3',      token: '離島3', amount: 5000,  defaultChecked: false, isProduct: true,  category: 'そのほか' }
  ];

  function checkboxId(opt) {
    return opt.id + '-checkbox';
  }

  // 商品マスタに存在しない固定額オプション（管有など）をテキストから検出する。
  // 商品マスタに存在するもの（離島など）は通常商品として計算させるため対象外。
  function findStandalone(text) {
    var s = String(text || '');
    if (!s) return null;
    for (var i = 0; i < OPTIONS.length; i++) {
      var opt = OPTIONS[i];
      if (!opt.isProduct && s.indexOf(opt.token) !== -1) return opt;
    }
    return null;
  }

  global.FixedFees = {
    options: OPTIONS,
    checkboxId: checkboxId,
    findStandalone: findStandalone
  };
})(window);
