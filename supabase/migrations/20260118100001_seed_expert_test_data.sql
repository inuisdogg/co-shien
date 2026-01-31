-- Expert領域テストデータ
-- 開発・動作確認用の専門家プロフィールを作成

-- まず、テスト用ユーザーを作成（存在しない場合）
-- user_type は 'staff' または 'client' のみ許可
INSERT INTO users (id, email, name, user_type, login_id, password_hash)
VALUES
  ('dev-expert-001', 'expert-st@example.com', '佐藤 美咲', 'staff', 'expert-st', 'hashed_password'),
  ('dev-expert-002', 'expert-pt@example.com', '高橋 健太', 'staff', 'expert-pt', 'hashed_password'),
  ('dev-expert-003', 'expert-ot@example.com', '田中 裕子', 'staff', 'expert-ot', 'hashed_password'),
  ('dev-expert-004', 'expert-psy@example.com', '山田 花子', 'staff', 'expert-psy', 'hashed_password'),
  ('dev-expert-005', 'expert-nurse@example.com', '鈴木 太郎', 'staff', 'expert-nurse', 'hashed_password'),
  ('dev-expert-006', 'expert-diet@example.com', '伊藤 さくら', 'staff', 'expert-diet', 'hashed_password')
ON CONFLICT (id) DO NOTHING;

-- エキスパートプロフィールを作成
INSERT INTO expert_profiles (
  id, user_id, display_name, profession, specialty, introduction, experience_years,
  qualification_status, is_public, is_accepting_consultations,
  price_per_message, free_first_message, rating_average, rating_count, total_consultations,
  page_theme
) VALUES
-- 言語聴覚士（ST）
(
  'expert-profile-001',
  'dev-expert-001',
  '佐藤 美咲',
  'ST',
  ARRAY['発語遅滞', '構音障害', '嚥下指導', '自閉症スペクトラム'],
  '10年以上の臨床経験に基づき、お子様の発語やコミュニケーションの悩みに寄り添います。家庭でできるトレーニングを重視しています。小児専門病院と療育センターでの経験を活かし、一人ひとりに合わせたアドバイスを提供します。',
  12,
  'verified',
  true,
  true,
  200,
  true,
  4.9,
  124,
  256,
  '{"primaryColor": "#10B981", "backgroundStyle": "simple", "profileImage": null}'::JSONB
),
-- 理学療法士（PT）
(
  'expert-profile-002',
  'dev-expert-002',
  '高橋 健太',
  'PT',
  ARRAY['運動発達', '姿勢矯正', '脳性麻痺', '低緊張'],
  '遊びを取り入れたリハビリテーションが得意です。お子様の「動きたい」という意欲を引き出すアプローチを提案します。運動発達に不安をお持ちの保護者様、お気軽にご相談ください。',
  8,
  'verified',
  true,
  true,
  150,
  true,
  4.8,
  89,
  178,
  '{"primaryColor": "#3B82F6", "backgroundStyle": "simple", "profileImage": null}'::JSONB
),
-- 作業療法士（OT）
(
  'expert-profile-003',
  'dev-expert-003',
  '田中 裕子',
  'OT',
  ARRAY['感覚統合', 'ADHD', '手先の器用さ', '学習支援'],
  '生活の中での「困りごと」を解決するお手伝いをします。感覚の過敏さや集中力でお悩みの方はぜひご相談ください。お子様の強みを活かしながら、日常生活をより過ごしやすくするヒントをお伝えします。',
  15,
  'verified',
  true,
  true,
  200,
  true,
  5.0,
  56,
  112,
  '{"primaryColor": "#8B5CF6", "backgroundStyle": "simple", "profileImage": null}'::JSONB
),
-- 臨床心理士
(
  'expert-profile-004',
  'dev-expert-004',
  '山田 花子',
  'psychologist',
  ARRAY['発達障害', '不登校', '親子関係', 'ペアレントトレーニング'],
  '公認心理師・臨床心理士として、お子様の心の発達と保護者様のお悩みに寄り添います。子育ての不安や困りごと、なんでもお話しください。一緒に解決の糸口を見つけていきましょう。',
  10,
  'verified',
  true,
  true,
  250,
  false,
  4.7,
  203,
  450,
  '{"primaryColor": "#EC4899", "backgroundStyle": "simple", "profileImage": null}'::JSONB
),
-- 看護師
(
  'expert-profile-005',
  'dev-expert-005',
  '鈴木 太郎',
  'nurse',
  ARRAY['医療的ケア', '小児看護', '在宅ケア', '発熱時の対応'],
  '小児科病棟での15年の経験を活かし、お子様の健康に関するご相談にお答えします。発熱、発疹、感染症など、日常の健康管理から医療的ケアまで幅広く対応いたします。',
  15,
  'verified',
  true,
  true,
  180,
  true,
  4.6,
  67,
  134,
  '{"primaryColor": "#EF4444", "backgroundStyle": "simple", "profileImage": null}'::JSONB
),
-- 管理栄養士
(
  'expert-profile-006',
  'dev-expert-006',
  '伊藤 さくら',
  'dietitian',
  ARRAY['偏食改善', '食物アレルギー', '離乳食', '成長曲線'],
  '保育園栄養士として10年以上の経験があります。偏食、少食、食物アレルギーなど、お子様の食に関するお悩みに、具体的なメニューや調理法を交えてアドバイスいたします。',
  11,
  'verified',
  true,
  true,
  180,
  true,
  4.8,
  98,
  210,
  '{"primaryColor": "#F59E0B", "backgroundStyle": "simple", "profileImage": null}'::JSONB
)
ON CONFLICT (id) DO UPDATE SET
  qualification_status = 'verified',
  is_public = true,
  is_accepting_consultations = true;

-- コラムサンプルデータ
INSERT INTO expert_columns (
  id, expert_id, title, content, tags, is_published, is_premium, published_at, view_count, like_count
) VALUES
(
  'column-001',
  'expert-profile-001',
  '言葉が遅いかも？と思ったら　〜家庭でできる言語発達サポート〜',
  E'お子さまの言葉の発達について不安を感じている保護者の方は多いと思います。\n\n## いつ頃から言葉が出始める？\n\n一般的に、最初の有意味語（ママ、パパなど）は1歳前後で出現します。ただし、個人差が非常に大きいのが言語発達の特徴です。\n\n## 家庭でできるサポート\n\n1. **たくさん話しかける**：日常の動作を言葉にして伝えましょう\n2. **絵本の読み聞かせ**：毎日少しずつでOK\n3. **子どもの発声を認める**：うなずきや笑顔で応答を\n\n## 心配なときは専門家へ\n\n2歳を過ぎても有意味語が出ない、言葉の理解が難しそうなど気になることがあれば、早めに専門家にご相談ください。',
  ARRAY['言語発達', '家庭療育', '発語'],
  true,
  false,
  NOW() - INTERVAL '7 days',
  1250,
  89
),
(
  'column-002',
  'expert-profile-002',
  'おうちでできる運動発達を促す遊び10選',
  E'お子さまの運動発達を促すには、日常の遊びが最も効果的です。\n\n## 室内でできる遊び\n\n1. **トンネルくぐり**：クッションや布団でトンネルを作ろう\n2. **風船遊び**：落とさないように追いかける\n3. **お手玉キャッチ**：目と手の協調性を育てる\n\n## 屋外での遊び\n\n4. **ボール遊び**：投げる・蹴る・転がす\n5. **かけっこ**：スタート・ストップを意識して\n6. **ブランコ**：体幹を鍛える\n\n楽しみながら体を動かすことが一番大切です！',
  ARRAY['運動発達', '遊び', '家庭療育'],
  true,
  false,
  NOW() - INTERVAL '14 days',
  980,
  67
),
(
  'column-003',
  'expert-profile-003',
  '感覚過敏のあるお子さまへの接し方',
  E'感覚過敏は、特定の刺激に対して過剰に反応してしまう状態です。\n\n## よくある感覚過敏の種類\n\n- **聴覚過敏**：大きな音、特定の音が苦手\n- **触覚過敏**：特定の素材の服が着られない\n- **視覚過敏**：明るい光がまぶしい\n\n## 家庭でできる工夫\n\n1. 苦手な刺激を無理強いしない\n2. 予測可能な環境を作る\n3. イヤーマフなどの感覚調整グッズを活用\n\n## 大切なこと\n\n感覚過敏は「わがまま」ではありません。お子さまの感じ方を理解し、安心できる環境を一緒に作っていきましょう。',
  ARRAY['感覚過敏', '感覚統合', '環境調整'],
  true,
  true,
  NOW() - INTERVAL '3 days',
  520,
  45
)
ON CONFLICT (id) DO NOTHING;
