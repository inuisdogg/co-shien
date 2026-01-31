co-shien Expert 構築用追加仕様書

1. 概要

本ドキュメントは、既存の biz, personal, client 領域に加え、専門職（PT/OT/ST/心理士等）がリモート相談やスポットワークを提供するための /expert 領域をゼロから構築するための指示書である。

2. 前提条件

Identity First: すべての Expert ユーザー（専門職側）は既に personal アカウント（profiles テーブル）を所有していることが前提。
登録するにはpersonalアカウントを作成するよう自然に誘導すること。
利用者は利用者アカウントを登録するものとする


技術スタック: 既存の開発環境に合わせる

デザイン: 清潔感のあるモダンなUI。エキスパートのメインカラーは#10B981にして。

3. ディレクトリ構造

src/app/expert 配下に以下の構成を作成すること。

/expert/page.tsx: 専門職用ダッシュボード（売上、相談リクエスト一覧、スポット案件表示）。

/expert/settings: プロフィール・単価設定（メッセージ単価、ビデオ通話10分/30分単価）。

/expert/consultations: 相談履歴とチャット管理。

/expert/wallet: 報酬確認と出金管理（Stripe Connect 連携）。

4. データベース拡張要件

以下のテーブルを新規作成または拡張すること。
ただし、すでに存在するテーブルがあればそちらを流用するものとする。あくまでも以下は例として挙げただけ。

① expert_profiles (新規)

profiles テーブルを 1:1 で拡張。

profile_id: references profiles(id)

specialty_tags: string[] (PT, OT, ST, 心理士 等)

bio: text (自己紹介・経歴)

qualifications: string[] (保有資格証書)

is_verified: boolean (運営による資格確認済フラグ)

② expert_pricing (新規)

expert_id: references profiles(id)

message_rate: int (メッセージ1往復あたりの単価)

video_rate_10min: int (10分ビデオ通話単価)

video_rate_30min: int (30分ビデオ通話単価)

③ consultation_transactions (新規)

id: UUID

expert_id: UUID

client_id: UUID

type: enum ('message', 'video_10', 'video_30')

status: enum ('pending', 'active', 'completed', 'canceled')

stripe_payment_intent_id: string

5. 主要機能の実装仕様

5.1 価格設定機能

専門職が自分のスキルに見合った単価を自由に設定できるUI。

「相談を受け付ける」のトグルスイッチ。

5.2 相談チャット・ビデオ通話フロー

メッセージ: client からの相談が届くと expert に通知。返信時に Stripe Capture を実行し売上確定。

ビデオ通話: 予約時間に合わせたルーム生成（Agora/Zoom等のスタブ）と決済確認。

5.3 Stripe Connect 連携

expert ユーザーが Stripe Connect Express アカウントを作成・紐付けできるオンボーディングフロー。

売上から 20% のシステム手数料を差し引き、残金を expert の Stripe 残高へ送金するロジック。

6. Claude Code への具体的な実行指示

docs/FINAL_MASTER_SPEC.md と docs/EXPERT_IMPLEMENTATION_PLAN.md を読み込むこと。

src/app/expert ディレクトリを新規作成し、専門職がまず自分の相談単価を設定できる /expert/settings 画面から実装を開始すること。

expert ログイン時は、personal アカウントとして認証されていることを確認し、不足している expert_profiles データを補完する動線を作ること。

UIはモバイル（WebView/PWA）で見られることを想定し、片手で操作しやすいリスト形式を採用すること。