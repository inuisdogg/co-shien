# 投資家デモ向け 不具合リスト

調査日: 2026-03-03
対象施設: pocopoco (facility-1770623012121)

---

## 致命的（デモで必ず見える・クラッシュする）

### D-01: キャリア業務タブ — 本日の予定が全部 "undefined" 表示
- **ファイル**: `src/app/career/page.tsx` L2372-2382
- **内容**: 業務タブの「本日の利用児童」が `s.child_name`, `s.start_time`, `s.end_time` を参照しているが、実際のデータは `s.childName`, `s.slot` (camelCase)。結果として名前が空白、時間が "undefined - undefined" と表示される
- **修正**: プロパティ名を正しいcamelCaseに修正

### D-02: キャリア業務タブ — 経過時間・出退勤時間が表示されない
- **ファイル**: `src/app/career/page.tsx` L2259-2260, L2301-2304
- **内容**: `attendance.clockIn` / `attendance.clockOut` を参照しているが、実際の型は `startTime` / `endTime`。WorkedTimeDisplayも出退勤時間表示も動かない
- **修正**: `clockIn` → `startTime`, `clockOut` → `endTime`

### D-03: 送迎管理 — Google Directions API が CORS エラーで動かない
- **ファイル**: `src/utils/googleMaps.ts` L119
- **内容**: Google Directions REST API をブラウザから直接呼んでいるが、このAPIはサーバーサイド専用でCORS非対応。ルート計算・ジオコーディングが全て失敗する
- **修正**: Next.js API Route経由でプロキシするか、Maps JavaScript API の DirectionsService を使用

### D-04: 送迎管理 — 児童カード登録でNOT NULL制約エラー
- **ファイル**: `src/components/schedule/TransportAssignmentPanel.tsx` L425-426
- **内容**: `daily_transport_assignments` テーブルの `driver_staff_id`, `attendant_staff_id` がNOT NULLなのに、コードが `null` を挿入しようとする。スタッフ未選択時にINSERT失敗
- **修正**: NOT NULLカラムにデフォルト値を設定するか、マイグレーションでNULLABLEに変更

---

## 重要（デモ中に気づく・見た目がおかしい）

### I-01: ダッシュボード出勤スタッフ数が実際の出勤数でなく登録数を表示
- **ファイル**: `src/components/dashboard/DashboardView.tsx` L889-903
- **内容**: 「出勤スタッフ」カードが `staff.length`(全登録数9名)を表示。実際の出勤者数ではない
- **修正**: `attendanceSummary.clockedIn` を表示

### I-02: スケジュール画面 — 定員が 0/0 表示になる可能性
- **ファイル**: `src/components/schedule/ScheduleView.tsx` L226-243
- **内容**: `facility_settings.capacity` のJSONBキーが小文字 `{am: 10, pm: 10}` の場合、コードは大文字 `AM`/`PM` を参照するため `undefined` → `0` になる
- **要確認**: 実際のDB値を確認して不一致なら修正

### I-03: 児童管理 — 招待機能が常に無反応
- **ファイル**: `src/components/children/ChildrenView.tsx` L175
- **内容**: `localStorage.getItem('selectedFacilityId')` を参照しているが、このキーは一度もセットされない。招待状態の取得が常にスキップされる
- **修正**: `facility?.id` を使用

### I-04: 通知ベル — 未読数が常に不正確
- **ファイル**: `src/hooks/useNotifications.ts` L15-25, L118, L139
- **内容**: `notifications` テーブルのカラム名は `is_read` なのに、コードは `read` を使用。未読フィルタ・既読更新が全て失敗
- **修正**: `read` → `is_read`

### I-05: 送迎管理 — ページリロードでアクティブセッションが消える
- **ファイル**: `src/hooks/useTransportSession.ts`
- **内容**: `loadActiveSession` が一度も呼ばれないため、GPSトラッキング中にページ遷移→戻るとセッションが消失
- **修正**: `TransportManagementView` のマウント時に `loadActiveSession` を呼ぶ

### I-06: 送迎管理 — ドライバー名が常に「未割当」表示
- **ファイル**: `src/components/transport/TransportStatusWidget.tsx` L64
- **内容**: `driver_staff_id` で `users` テーブルを検索しているが、IDが `staff` テーブルのもの。users テーブルにマッチしないのでドライバー名が表示されない
- **修正**: `staff` テーブルまたは正しいJOINで検索

### I-07: 送迎管理 — ルート計算の出発地が常に施設（pickup時も）
- **ファイル**: `src/components/transport/TransportManagementView.tsx` L421-422
- **内容**: `origin = mode === 'pickup' ? facilityLocation : facilityLocation` — 三項演算子の両辺が同じ。コピペミス
- **修正**: pickupモード時の出発地ロジックを修正

### I-08: 施設設定エディタの変更がスケジュールに反映されない
- **ファイル**: `src/components/children/FacilitySettingsEditor.tsx` L169-213
- **内容**: 児童のパターン設定変更が `facility_children_settings` に保存されるが、スケジュールは `children` テーブルの `pattern_days` を参照。反映されない
- **修正**: 両テーブルに書き込むか、スケジュール側のクエリを変更

### I-09: スタッフ一覧 — `emp-` prefix スタッフが送迎ドライバーリストに出ない
- **ファイル**: `src/components/schedule/TransportAssignmentPanel.tsx` L199-211
- **内容**: ドライバー/添乗員リストが `staff` テーブルのみ検索。`employment_records` のみのスタッフが表示されない
- **修正**: employment_records + users のJOINも含める

### I-10: 保護者ページ — 名前未設定で「ようこそ、さん」表示
- **ファイル**: `src/app/parent/page.tsx` L1094
- **内容**: `currentUser.last_name` が空で `name` も空の場合、「ようこそ、さん」と表示される
- **修正**: フォールバック名を追加

---

## 軽微（デモで表面化しにくい）

### L-01: セッションタイムアウト 30分で自動ログアウト
- **ファイル**: `src/contexts/AuthContext.tsx` L218-240
- **内容**: 30分操作しないと自動ログアウト。デモ中の長い説明中にセッション切れの可能性
- **対策**: デモ前にタイムアウト値を延長 or 定期的にマウス操作

### L-02: 児童登録 — 郵便番号がDBに保存されない
- **ファイル**: `src/hooks/useChildrenData.ts` L92-151
- **内容**: `childToDbRow` が `postalCode` → `postal_code` のマッピングを持たない。入力しても保存されない
- **修正**: マッピングに `postal_code: child.postalCode` を追加

### L-03: 日曜日にスケジュール画面を見ると翌週が表示される
- **ファイル**: `src/components/schedule/ScheduleView.tsx` L341-367
- **内容**: 日曜日 (getDay()===0) の週頭計算が翌月曜を返す
- **対策**: デモが日曜でなければ問題なし

### L-04: 送迎完了トグルのエラーハンドリングなし
- **ファイル**: `src/components/transport/TransportManagementView.tsx` L515-528
- **内容**: Supabase insert/updateのエラーをチェックしていない。失敗しても成功表示
- **修正**: `error` チェック追加

### L-05: `today` 変数が日付跨ぎで更新されない（複数箇所）
- **ファイル**: TransportManagementView, TransportStatusWidget, useTransportSession
- **内容**: `new Date()` が一度だけ計算される。深夜をまたぐとデータ取得日がずれる
- **対策**: デモ中に日付が変わらなければ問題なし

### L-06: ETA カウントダウンが毎秒setIntervalを再生成
- **ファイル**: `src/hooks/useTransportTracker.ts` L167-175
- **内容**: `displayEta` がdeps配列に入っていて毎秒effectが再実行される
- **修正**: refベースに変更

### L-07: 送迎スタッフ月間統計がレガシーカラムで二重カウント
- **ファイル**: `src/components/schedule/TransportAssignmentPanel.tsx` L296-306
- **内容**: 新カラムとレガシーカラム両方をカウントして同じスタッフが2回集計される
- **修正**: レガシーカラムを除外

### L-08: ChildrenView `window.location.reload()` でUI状態リセット
- **ファイル**: `src/components/children/ChildrenView.tsx` L370
- **内容**: 契約ステータス変更時にフルリロードしてUIが一瞬消える
- **修正**: React stateでリフレッシュ

---

## データベース状態サマリー

| テーブル | 件数 | 状態 |
|---------|------|------|
| children | 10 | demo-child-001〜010 |
| staff | 9 | 畠(管理者) + 8名 |
| staff_personnel_settings | 0 | 空 — 全員「要設定」バッジ |
| employment_records | 3+ | 畠(管理者), 酒井, 平井 |
| schedules | 0 | 空 |
| daily_transport_assignments | 0 | 空 |
| transport_sessions | 0 | 空 |
| monthly_shift_schedules | 0 | 空 |
| attendance_records | 3 | 畠の2/15分のみ |
| billing_records | 0 | 空 |
| support_plan_files | 0 | 空 |
| daily_logs | 0 | 空 |
| staff_documents | 3+ | 酒井の資格証等 |
| employment_contracts | 0 | 空 |
| facility_settings | 1 | 定員AM:10, PM:10 |

---

## 推奨修正順序

1. **D-01, D-02** — キャリア業務タブ（即修正可、影響範囲小）
2. **I-01** — ダッシュボード出勤数（1行修正）
3. **I-02** — スケジュール定員表示（DB値確認→修正）
4. **I-03** — 児童招待機能（1行修正）
5. **I-04** — 通知未読数（カラム名置換）
6. **D-04** — 送迎NOT NULL制約（マイグレーション）
7. **D-03, I-05〜I-07** — 送迎全般（大きめの修正）
8. 残りのI項目・L項目
