# 開発・テスト用アカウント一覧

## ドメイン構成

| ドメイン | 用途 |
|---------|------|
| roots.inu.co.jp/business | スタッフ用 |
| roots.inu.co.jp/career | 利用者用 |
| localhost:3000 | 開発環境（すべてアクセス可） |

---

## 施設

| 施設名 | 施設コード |
|--------|-----------|
| サンプル施設 | SAMPLE |

---

## スタッフアカウント

| ログインID | パスワード |
|-----------|-----------|
| staff-test-001 | test123 |

**ログイン方法**: http://localhost:3000/ または https://roots.inu.co.jp/business/

---

## 利用者アカウント

| ログインID | パスワード | 子供 |
|-----------|-----------|------|
| client-test-001 | test123 | テスト太郎 |

**ログイン方法**: http://localhost:3000/client/login または https://roots.inu.co.jp/career/

---

## データ構成

- スタッフ(staff-test-001) → サンプル施設(facility-demo-001)に所属
- 利用者(client-test-001) → 子供「テスト太郎」がサンプル施設と契約済み
- チャット機能: スタッフと利用者間で双方向通信可能
