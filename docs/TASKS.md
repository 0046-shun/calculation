# 刷新タスクリスト（Calculation Apps）

目的: 保守性・拡張性・正確性を高めつつ、運用継続しながら段階的に刷新する。

## フェーズ別ロードマップ（進捗）

### 短期（1）安全性・一貫性の確保
- [x] コア計算ロジックの純関数化と共通化（通常/基礎/特則）
- [x] `reverse_check.js` から計算コアへ委譲（重複排除）
- [x] `data.js` をスキーマに沿って整理（カテゴリ/商品/属性/ルールの明文化）
  - [x] Firestore スキーマ定義（`docs/DB_SCHEMA.md`）
  - [x] 既存データ→スキーマ変換（`core_data.js` の `goodsToSchema`/`kisoToSchema`）
  - [x] 確認・出力ページ（`schema_preview.html`）で `products.json` 生成
  - [x] 既存 `data.js` 全量のスキーマ整形（命名/タグ/特則の明記）
- [x] カビ/BM/SO2買/基礎セット割/クラックの境界テスト作成（スナップショット含む）
- [x] 共通ユーティリティ（format/normalize/similarity）一本化

### 中期（2）型とルールの強化
- [ ] TypeScript導入（型: 商品・価格ルール・計算結果・貼付行）
- [ ] 価格ルールの宣言化（条件→効果: 単価上書き/割引適用/セット割）
- [ ] ビルド最小導入（Vite か ESM直）とテスト（Vitest/Jest）
- [ ] UI/UX整備（アクセシビリティ、小画面最適化、フォーカス保持の一貫化）

### 長期（3）運用・自動化の充実
- [ ] E2E（Playwright）：計算・逆チェック・コピー機能の回帰
- [ ] ドキュメント拡充（仕様・データ定義・運用手順）
- [ ] 監視・エラーレポート（Sentry 等は任意）

---

## Firebase（DB化）移行計画（進捗）

目標: 商品情報（単価・超過単価・基本数量・助数詞等）を Firestore で管理し、管理者画面から動的更新→アプリへ即時反映。

### データモデル案（Cloud Firestore）
コレクション: `products`
- ドキュメントID: 任意（例: `shoudoku-再`, `kiso-外基礎-新規工事`）
- フィールド例:

```json
{
  "category": "消毒",                  // 大項目
  "itemName": "再",                    // 小項目（表示名）
  "pricing": {
    "base": 70000,                     // 基本価格（任意）
    "unitPrice": 1500,                 // 単価
    "basicQty": 40,                    // 基本数量/しきい値（areaThreshold）
    "excessCalc": "overOnly"          // 超過加算方式: overOnly | perQty | none
  },
  "unitLabel": "㎡",                   // 助数詞（例: ㎡, 個, m）
  "tags": ["特則:カビ対象"],
  "rules": [                           // 宣言的ルール
    { "when": {"category": "消毒"}, "apply": {"unitPrice": 1000}, "scope": "カビ" },
    { "when": {"itemIncludes": ["DC2", "60"]}, "apply": {"unitPrice": 1700}, "scope": "カビ" }
  ],
  "status": "published",              // draft | published
  "updatedAt": 1737427200000,
  "updatedBy": "uid_XXXX"
}
```

補足:
- 基礎系は `category` を「新規工事/追加工事/クラック」で持ち、`pricingByHeight` を別構造にしても良い
  - 例: `pricingByHeight: { "30": { basicPrice, lengthUnitPrice, basicLength }, ... }`
- セット割（外基礎・中基礎）などは `rules` にセット条件→小計控除を記述

### セキュリティ/公開ワークフロー
- [x] 認証: Google認証（管理者画面アクセス）
- [ ] Firestore セキュリティルール最終確定
  - 一般ユーザ: 読取可（`status == "published"` のみ）/ 書込不可
  - 管理者: 読書/書込可（Draft/Publish 切替）→ 管理者メールをルールに反映
- [ ] ルール/インデックスの CI デプロイ（`firebase deploy --only firestore:rules,indexes`）

### 管理者画面（最小機能）
- [x] ログイン/ログアウト（Google認証）
- [x] 商品登録（通常/基礎の切替、入力補助）
- [x] 商品一覧・並び順（カテゴリ優先順→商品名）
- [x] 絞り込み（公開状態/カテゴリ）
- [x] 商品編集（カテゴリ/商品名/助数詞/価格・高さ別価格/公開状態）
- [x] Draft/Publish 切替、削除
- [ ] 複合商品/セット割のプレビュー（計算コアで即時試算）
- [ ] 変更履歴/差分（`updatedBy/updatedAt`）

### アプリ統合（段階導入）
- [x] Feature Flag で `data.js` → Firestore 切替（併存可）
- [x] 初回ロード時に `products` 読込（カテゴリ/商品へ供給）
- [ ] キャッシュ戦略（IndexedDB/メモリ）とエラーフォールバック（`data.js`）
- [ ] 特則（カビ/BM/SO2買/セット割/クラック）をルールとして処理できるか検証、過渡期は一部ハードコードを維持

### データ移行
- [x] `schema_preview.html` で `products.json` を生成可能
- [ ] `data.js` → Firestore への反映（GUI or スクリプト）
- [ ] ゴールデンケースで旧/新結果一致の照合レポート

### 運用
- [ ] バックアップ/エクスポート運用（`gcloud` or `firestore:export`）
- [ ] 監査ログ（更新者/更新内容）

---

## 実装優先度（推奨）
1) 計算コアの共通化 + テスト
2) Firestore スキーマ確定 + 移行スクリプト
3) 読込のみ Firestore 切替（管理は Draft 運用）
4) 管理者画面 CRUD + Publish ワークフロー
5) ルール宣言化の段階適用（特則移行）

---

## 本日の作業メモ
- 管理者画面を実装・日本語化（登録/編集/並べ替え/絞り込み/公開切替/削除）
- Firestore 読み込み切替とフォールバック（`core_data_fetch.js`）
- スキーマ確認/出力ページ `schema_preview.html`・変換ユーティリティ `core_data.js` を用意
- 一括インポート機能は UI から削除（個別登録＋編集運用）

## 次回の優先タスク（提案）
1) Firestore ルールの最終確定（管理者メールの登録）
2) `data.js` 全量のスキーマ整形と登録（`products.json` 生成→GUIで順次反映）
3) キャッシュ戦略とフォールバック整理（UIの読み込み安定化）
4) 宣言的ルール化の検証（カビ/BM/SO2買/セット割/クラック）

---

## 成果物チェックリスト
- [ ] 旧/新の計算結果が主要ケースで一致
- [ ] 価格データ変更が管理画面から反映（Draft→Publish）
- [ ] セキュリティルールで一般ユーザは published のみ参照
- [ ] 逆チェックは新コアを使用し計算一致
- [ ] 回帰テストがCIで自動実行


