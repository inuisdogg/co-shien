# Roots iOS App Store 提出ガイド

## 概要

Roots は3つの iOS アプリとして App Store に提出します:

| アプリ名 | Bundle ID | 対象ユーザー | サーバーURL |
|---------|-----------|------------|------------|
| Roots | `jp.co.inu.coshien.client` | 保護者（利用者） | `https://roots.inu.co.jp/parent` |
| Roots Staff | `jp.co.inu.coshien.staff` | スタッフ（従業員） | `https://roots.inu.co.jp/career` |
| Roots Biz | `jp.co.inu.coshien.facility` | 施設管理者 | `https://roots.inu.co.jp/business` |

各アプリは Capacitor の「Live Web Mode」を使用し、Web サーバーからコンテンツを読み込みます。
Web を更新すればアプリも自動的に更新されます。

---

## 1. Apple Developer Program 登録手順

### 1-1. 登録に必要なもの
- Apple ID（2ファクタ認証が有効であること）
- 法人の場合: D-U-N-S番号（申請から取得まで最大14営業日）
- 年間費用: $99 USD（約15,000円）

### 1-2. 登録手順
1. [Apple Developer Program](https://developer.apple.com/programs/) にアクセス
2. 「Enroll」をクリック
3. Apple ID でサインイン
4. 個人または組織を選択
   - **法人の場合**: 組織を選択し、D-U-N-S番号を入力
   - **個人の場合**: 個人を選択（法人名がストアに表示されない）
5. 利用規約に同意し、年間費用を支払い
6. 承認まで最大48時間待機

### 1-3. 注意点
- 法人登録を強く推奨（アプリの信頼性向上）
- D-U-N-S番号は [こちら](https://developer.apple.com/enroll/duns-lookup/) で無料で申請可能
- 3つのアプリを1つのデベロッパーアカウントで管理可能

---

## 2. 証明書と Provisioning Profile の作成手順

### 2-1. 証明書の作成
1. Xcode を開く > Settings > Accounts > Apple ID を追加
2. 「Manage Certificates」で「Apple Distribution」証明書を作成
3. または [Apple Developer Portal](https://developer.apple.com/account/resources/certificates) で手動作成:
   - キーチェーンアクセスで CSR（証明書署名要求）を生成
   - Developer Portal で Distribution 証明書を申請
   - ダウンロードしてキーチェーンに追加

### 2-2. App ID の登録
3つのアプリそれぞれに App ID を作成:
1. Developer Portal > Identifiers > 「+」ボタン
2. 「App IDs」を選択
3. 以下の情報を入力:
   - **Roots**: Bundle ID = `jp.co.inu.coshien.client`
   - **Roots Staff**: Bundle ID = `jp.co.inu.coshien.staff`
   - **Roots Biz**: Bundle ID = `jp.co.inu.coshien.facility`
4. Capabilities で以下を有効化:
   - Push Notifications
   - Associated Domains

### 2-3. Provisioning Profile の作成
1. Developer Portal > Profiles > 「+」ボタン
2. 「App Store Connect」を選択
3. 対象の App ID を選択
4. 証明書を選択
5. プロファイル名を入力（例: `Roots Client Distribution`）
6. ダウンロードして Xcode にインストール

---

## 3. App Store Connect でのアプリ登録手順

### 3-1. 新しいアプリの作成
[App Store Connect](https://appstoreconnect.apple.com/) で3つのアプリをそれぞれ登録:

1. 「マイApp」>「+」>「新規App」
2. 以下を入力:

**Roots（保護者アプリ）**
- プラットフォーム: iOS
- 名前: Roots
- プライマリ言語: 日本語
- バンドルID: `jp.co.inu.coshien.client`
- SKU: `roots-client-001`

**Roots Staff（スタッフアプリ）**
- 名前: Roots Staff
- バンドルID: `jp.co.inu.coshien.staff`
- SKU: `roots-staff-001`

**Roots Biz（施設管理アプリ）**
- 名前: Roots Biz
- バンドルID: `jp.co.inu.coshien.facility`
- SKU: `roots-facility-001`

### 3-2. アプリ情報の設定

各アプリ共通:
- **カテゴリ**: プライマリ = ビジネス、セカンダリ = 仕事効率化
- **対象年齢**: 4+（不適切なコンテンツなし）
- **価格**: 無料
- **App内課金**: なし（決済は Stripe で処理）
- **ライセンス契約**: 標準のApple EULA を使用

### 3-3. スクリーンショットの準備

各アプリに以下のサイズのスクリーンショットが必要:
- **6.7インチ** (iPhone 15 Pro Max): 1290 x 2796 px
- **6.5インチ** (iPhone 11 Pro Max): 1242 x 2688 px
- **5.5インチ** (iPhone 8 Plus): 1242 x 2208 px（任意）
- **12.9インチ iPad Pro**: 2048 x 2732 px（iPad対応の場合）

各アプリ最低3枚、最大10枚のスクリーンショットを用意。

### 3-4. アプリの説明文（例: Roots 保護者アプリ）

```
Rootsは、放課後等デイサービス・児童発達支援施設の利用者向けアプリです。

主な機能:
- お子様の利用予約と管理
- 施設からのお知らせ確認
- 連絡帳の閲覧
- 利用実績の確認
- 個別支援計画の閲覧と電子署名

施設との連携がスムーズになり、お子様の支援をより良くサポートします。

※ ご利用には施設からの招待が必要です。
```

---

## 4. Xcode でのビルドとアーカイブ手順

### 4-1. プロジェクトを開く
```bash
cd ios-apps/client  # または staff, facility
npx cap sync ios
open ios/App/App.xcworkspace
```

### 4-2. Xcode での設定
1. プロジェクト設定を開く（左ペインで「App」を選択）
2. 「Signing & Capabilities」タブ:
   - Team: 自社のデベロッパーチームを選択
   - 「Automatically manage signing」にチェック
3. 「General」タブ:
   - Version: `1.0.0`（初回リリース）
   - Build: `1`

### 4-3. アーカイブの作成
1. Xcode 上部で実行先を「Any iOS Device (arm64)」に変更
2. メニュー: Product > Archive
3. ビルドが完了するとオーガナイザーが開く

### 4-4. 注意事項
- Simulator ではなく実機（Any iOS Device）を選択すること
- ビルドエラーが出る場合は `npx cap sync ios` を再実行
- CocoaPods の問題がある場合: `cd ios/App && pod install --repo-update`

---

## 5. TestFlight 配信手順

### 5-1. アーカイブのアップロード
1. Xcode のオーガナイザーで対象のアーカイブを選択
2. 「Distribute App」をクリック
3. 「App Store Connect」を選択
4. 「Upload」を選択
5. オプション設定:
   - Strip Swift Symbols: Yes
   - Upload your app's symbols: Yes
   - Manage Version and Build Number: Yes
6. 「Upload」をクリック

### 5-2. TestFlight の設定
1. App Store Connect > 対象アプリ > TestFlight
2. 「Export Compliance」に回答:
   - 暗号化を使用していますか？ → **いいえ**（ITSAppUsesNonExemptEncryption = false に設定済み）
3. 内部テスト:
   - 「内部テスター」グループを作成
   - Apple Developer Program のメンバーを追加（最大100名）
   - ビルドが処理完了後、自動で配信
4. 外部テスト:
   - 「外部テスター」グループを作成
   - テスターのメールアドレスを追加（最大10,000名）
   - Beta App Review の承認が必要（通常1-2営業日）

### 5-3. テスターへの案内
テスターに TestFlight アプリのインストールを依頼し、招待メールから参加してもらう。

---

## 6. App Store 審査提出手順

### 6-1. 提出前チェックリスト
- [ ] スクリーンショット（全サイズ）がアップロード済み
- [ ] アプリの説明文が入力済み
- [ ] プライバシーポリシーの URL が設定済み
- [ ] サポート URL が設定済み
- [ ] カテゴリが設定済み
- [ ] 価格が設定済み（無料）
- [ ] 対象年齢が設定済み（4+）
- [ ] App Privacy（プライバシーラベル）が設定済み
- [ ] ビルドが選択済み

### 6-2. 審査への提出
1. App Store Connect > 対象アプリ > App Store タブ
2. 全ての必須情報を入力
3. 「審査に追加」をクリック
4. 「審査に送信」をクリック

### 6-3. 審査に関する情報
- **審査期間**: 通常24-48時間（初回は長くなる場合あり）
- **デモアカウント**: 審査用のログイン情報を提供する必要あり
  - 「App Review Information」セクションにデモアカウントのメール/パスワードを記入
  - **重要**: 3つのアプリそれぞれに適切な権限のアカウントを用意

### 6-4. デモアカウントの準備

| アプリ | デモアカウントの役割 | 必要な操作 |
|-------|-------------------|-----------|
| Roots | 保護者 | 児童登録済み、施設連携済み |
| Roots Staff | スタッフ | 施設所属済み、出退勤可能 |
| Roots Biz | 施設管理者 | 施設登録済み、スタッフ・児童データあり |

---

## 7. 審査で聞かれるプライバシー関連の回答例

### 7-1. App Privacy（プライバシーラベル）

App Store Connect の「App Privacy」セクションで以下を設定:

**収集するデータ:**

| データタイプ | 用途 | ユーザーに紐付け | トラッキングに使用 |
|------------|------|----------------|-----------------|
| 名前 | アプリの機能 | はい | いいえ |
| メールアドレス | アプリの機能 | はい | いいえ |
| 使用状況データ | 分析 | はい | いいえ |
| おおよその位置情報 | アプリの機能 | はい | いいえ |

### 7-2. プライバシーポリシー

プライバシーポリシーを Web 上に公開し、URL を App Store Connect に登録する必要があります。
推奨 URL: `https://roots.inu.co.jp/privacy`

含めるべき内容:
- 収集する個人情報の種類
- 情報の利用目的
- 第三者への情報提供について
- データの保管と削除について
- ユーザーの権利（アクセス・修正・削除の請求方法）
- 問い合わせ先

### 7-3. 審査で聞かれやすい質問と回答例

**Q: ログインが必要ですが、誰でも登録できますか？**
A: はい。メールアドレスで誰でもアカウントを作成できます。ただし、施設との連携には施設からの招待コードが必要です。

**Q: バックグラウンドで位置情報を使用していますか？**
A: いいえ。位置情報は出退勤記録時のみ使用し、バックグラウンドでは使用しません（NSLocationWhenInUseUsageDescription のみ）。

**Q: アプリ内課金はありますか？**
A: いいえ。アプリは無料で、課金は施設側と Web 上の Stripe を通じて行われます。アプリ内での購入機能はありません。

**Q: Web ビューのアプリですか？**
A: Capacitor フレームワークを使用したハイブリッドアプリです。ネイティブの Push 通知、カメラアクセス、Face ID 認証などのネイティブ機能を活用しています。

---

## 8. リジェクトされた場合の対応方法

### 8-1. よくあるリジェクト理由と対策

#### Guideline 4.2 - Minimum Functionality（最小機能要件）
**理由**: Web サイトをそのまま表示しているだけと判断された場合。
**対策**:
- Push 通知、カメラ、Face ID などのネイティブ機能を審査用メモで強調
- スクリーンショットでネイティブ機能の使用箇所を示す
- 「Review Notes」に以下のように記載:
  ```
  このアプリは Capacitor フレームワークを使用したハイブリッドアプリです。
  以下のネイティブ機能を活用しています:
  - Push 通知（施設からのお知らせ、予約変更通知）
  - カメラ（書類撮影、プロフィール写真）
  - Face ID / Touch ID（セキュアログイン）
  - 位置情報（出退勤記録の位置確認）
  ```

#### Guideline 2.1 - App Completeness（アプリの完全性）
**理由**: デモアカウントでログインできない、機能がクラッシュする。
**対策**:
- 審査前にデモアカウントで全機能をテスト
- サーバーがダウンしていないことを確認
- デモアカウントの認証情報が正しいことを再確認

#### Guideline 5.1.1 - Data Collection and Storage（データ収集）
**理由**: プライバシーラベルと実際のデータ収集が一致しない。
**対策**:
- プライバシーラベルを正確に設定
- プライバシーポリシーを最新の状態に保つ
- サードパーティ SDK のデータ収集も含めて申告

#### Guideline 1.2 - User Generated Content（ユーザー生成コンテンツ）
**理由**: ユーザーが投稿できるコンテンツ（チャットなど）がある場合。
**対策**:
- 不適切なコンテンツの報告・ブロック機能を実装
- コンテンツモデレーションの仕組みを説明

### 8-2. リジェクト後の対応フロー
1. App Store Connect で「Resolution Center」を確認
2. リジェクト理由を詳しく読む
3. 必要な修正を行う
4. 修正内容を「Resolution Center」で回答
5. 再提出

### 8-3. 審査チームとのコミュニケーション
- Resolution Center で日本語で回答可能
- 丁寧かつ具体的に回答する
- スクリーンショットや動画を添付すると効果的
- 回答から再審査まで通常24-48時間

---

## 補足: 3アプリ同時提出のワークフロー

### 推奨手順
1. まず **Roots（保護者アプリ）** を提出し、審査を通す
2. 審査で指摘された点を修正
3. 修正を反映して **Roots Staff** と **Roots Biz** を提出

### ビルド手順（全アプリ共通）
```bash
# 1. Web アプリをビルド（不要 - Live Web Mode のため）

# 2. iOS プロジェクトを同期
cd ios-apps/client  # or staff, facility
npx cap sync ios

# 3. Xcode でアーカイブ＆アップロード
open ios/App/App.xcworkspace
# Product > Archive > Distribute App
```

### アイコン生成
```bash
cd ios-apps
./generate-icons.sh /path/to/icon-1024x1024.png all
```

---

## チェックリスト

### Apple Developer Program
- [ ] Apple Developer Program に登録済み ($99/year)
- [ ] D-U-N-S番号を取得済み（法人の場合）

### 証明書・プロファイル
- [ ] Apple Distribution 証明書を作成済み
- [ ] 3つの App ID を登録済み
- [ ] 3つの Provisioning Profile を作成済み

### App Store Connect
- [ ] 3つのアプリを App Store Connect に登録済み
- [ ] スクリーンショットをアップロード済み
- [ ] アプリ説明文を入力済み
- [ ] プライバシーポリシー URL を設定済み
- [ ] サポート URL を設定済み
- [ ] プライバシーラベルを設定済み

### ビルド
- [ ] アプリアイコン（1024x1024）を準備済み
- [ ] `generate-icons.sh` でアイコンを生成済み
- [ ] 各アプリを Xcode でアーカイブ済み
- [ ] TestFlight でテスト済み

### 審査提出
- [ ] デモアカウントを準備済み
- [ ] Review Notes を記入済み
- [ ] 全アプリを審査に提出済み
