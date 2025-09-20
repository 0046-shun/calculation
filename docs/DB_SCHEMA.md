# Firestore データスキーマ（products）

目的: `data.js` の価格データを Cloud Firestore に移行し、管理画面から動的更新→アプリへ即時反映する。

## コレクション: `products`
- ドキュメントID: 任意（推奨: スラッグ形式 `category-item` など）
- フィールド:

```json
{
  "category": "消毒",
  "itemName": "再",
  "unitLabel": "㎡",
  "status": "published",
  "pricing": {
    "base": 70000,
    "unitPrice": 1500,
    "basicQty": 40,
    "excessCalc": "overOnly"
  },
  "rules": [
    { "when": {"category": "消毒"}, "apply": {"unitPrice": 1000}, "scope": "カビ" },
    { "when": {"itemIncludes": ["DC2", "60"]}, "apply": {"unitPrice": 1700}, "scope": "カビ" }
  ],
  "tags": ["特則:カビ対象"],
  "updatedAt": 1737427200000,
  "updatedBy": "uid_XXXX"
}
```

### 基礎系（新規工事/追加工事/クラック）
- 高さごとの価格を `pricingByHeight` に保持:

```json
{
  "category": "新規工事",
  "itemName": "外基礎",
  "unitLabel": "m",
  "pricingByHeight": {
    "30": { "basicPrice": 510000, "lengthUnitPrice": 6000, "basicLength": 20 },
    "40": { "basicPrice": 540000, "lengthUnitPrice": 7000, "basicLength": 20 }
  }
}
```

- クラックは長さではなく個数で計算（`basicPrice` は 0、`lengthUnitPrice` を個数に掛ける）。
- セット割（外基礎・中基礎）は `rules` に小計控除（例: 40000円）として記述。

## セキュリティルール（概要）
- 一般ユーザ: `status == "published"` の読み取りのみ許可。
- 管理者: CRUD 全許可。Draft→Publish の切替可能。

## インデックス例
- 検索/絞り込み用: `category asc, status asc, updatedAt desc`

## アプリ側データ整形
- Firestore → アプリ内 `goodsData`/`kisoProductsData` 相当へ変換。
- 正規化（全角→半角、小文字、表記ゆれ吸収）をロード時に実施し、検索/一致判定に使用。

## 併存期間の設計
- Feature Flag で `data.js`（フォールバック）と Firestore を切替。
- 読み込み失敗時は `data.js` を使用し、計算コアは現行のまま。
