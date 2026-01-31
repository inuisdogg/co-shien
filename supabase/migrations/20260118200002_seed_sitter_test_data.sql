-- Sitter テストデータ作成
-- 既存のユーザーID（dev-expert-*、dev-staff-user-001など）を活用

-- 1. シッタープロフィール
INSERT INTO sitter_profiles (
  id, user_id, display_name, profile_image, introduction,
  professions, specialty, hourly_rate, minimum_hours,
  service_areas, can_travel, travel_fee,
  is_tokyo_certified, subsidy_eligible, is_public, is_accepting_bookings,
  total_bookings, total_hours, rating_average, rating_count
) VALUES
-- シッター1: 言語聴覚士・保育士（東京都認定） - dev-expert-001を使用
(
  'sitter-test-001',
  'dev-expert-001',
  '小林 亜希',
  NULL,
  'お子様の「発語」を促す遊びを取り入れたシッティングが得意です。言語訓練のアドバイスも可能です。障害児施設での10年以上の経験があり、様々なお子様に対応できます。',
  ARRAY['ST', 'nursery_teacher'],
  ARRAY['発語遅滞', '言語訓練', '自閉症スペクトラム', '社会性発達'],
  3500,
  2,
  ARRAY['港区', '渋谷区', '品川区', '目黒区', '世田谷区'],
  true,
  500,
  true,
  true,
  true,
  true,
  42,
  126.5,
  4.9,
  38
),
-- シッター2: 理学療法士（東京都認定） - dev-expert-002を使用
(
  'sitter-test-002',
  'dev-expert-002',
  '田中 健太',
  NULL,
  '運動発達の専門家として、お子様の身体的な発達をサポートします。ダウン症や運動発達遅滞のお子様のケアに多くの実績があります。楽しく体を動かす遊びを通じて発達を促進します。',
  ARRAY['PT'],
  ARRAY['運動発達', 'ダウン症対応', '感覚統合', 'ADL支援'],
  3200,
  2,
  ARRAY['新宿区', '中野区', '杉並区', '練馬区', '豊島区'],
  true,
  800,
  true,
  true,
  true,
  true,
  28,
  84.0,
  4.7,
  24
),
-- シッター3: 作業療法士 - dev-expert-003を使用
(
  'sitter-test-003',
  'dev-expert-003',
  '山本 美咲',
  NULL,
  '感覚統合療法を専門とし、お子様の日常生活動作の自立を支援します。食事や着替えなどの基本的な生活スキルの獲得をサポートします。',
  ARRAY['OT'],
  ARRAY['感覚統合', 'ADL支援', '認知発達', '食事支援'],
  3000,
  2,
  ARRAY['文京区', '台東区', '墨田区', '江東区', '中央区'],
  true,
  600,
  false,
  false,
  true,
  true,
  15,
  45.0,
  4.8,
  12
),
-- シッター4: 看護師・保育士（東京都認定） - dev-expert-004を使用
(
  'sitter-test-004',
  'dev-expert-004',
  '佐藤 由美',
  NULL,
  '医療的ケア児の対応が可能な看護師です。経管栄養や吸引などの医療的ケアを必要とするお子様も安心してお任せください。保育士資格も保有しており、遊びを通じた発達支援も行います。',
  ARRAY['nurse', 'nursery_teacher'],
  ARRAY['医療的ケア児対応', '重症心身障害児対応', '食事支援'],
  4000,
  3,
  ARRAY['港区', '千代田区', '中央区', '品川区'],
  true,
  1000,
  true,
  true,
  true,
  true,
  35,
  140.0,
  5.0,
  32
),
-- シッター5: 臨床心理士 - dev-expert-005を使用
(
  'sitter-test-005',
  'dev-expert-005',
  '鈴木 恵理',
  NULL,
  '発達障害のお子様への心理的サポートを専門としています。行動面での困りごとがあるお子様に対して、適切な関わり方でシッティングを行います。保護者様へのアドバイスも可能です。',
  ARRAY['psychologist'],
  ARRAY['自閉症スペクトラム', '社会性発達', '認知発達'],
  3800,
  2,
  ARRAY['世田谷区', '目黒区', '大田区'],
  false,
  0,
  false,
  false,
  true,
  true,
  22,
  66.0,
  4.6,
  18
),
-- シッター6: 保育士（東京都認定） - dev-expert-006を使用
(
  'sitter-test-006',
  'dev-expert-006',
  '伊藤 さくら',
  NULL,
  '発達に不安のあるお子様へ丁寧に寄り添うシッティングを心がけています。遊びを通じた言葉やコミュニケーションの促進が得意です。',
  ARRAY['nursery_teacher'],
  ARRAY['発語遅滞', '社会性発達', '認知発達'],
  2800,
  2,
  ARRAY['渋谷区', '新宿区', '中野区', '杉並区', '世田谷区', '目黒区'],
  true,
  400,
  true,
  true,
  true,
  true,
  58,
  174.0,
  4.8,
  52
)
ON CONFLICT (user_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  introduction = EXCLUDED.introduction,
  professions = EXCLUDED.professions,
  specialty = EXCLUDED.specialty,
  hourly_rate = EXCLUDED.hourly_rate,
  service_areas = EXCLUDED.service_areas,
  is_tokyo_certified = EXCLUDED.is_tokyo_certified,
  subsidy_eligible = EXCLUDED.subsidy_eligible,
  is_public = EXCLUDED.is_public,
  total_bookings = EXCLUDED.total_bookings,
  rating_average = EXCLUDED.rating_average;

-- 2. シッター資格情報
INSERT INTO sitter_certifications (
  id, sitter_id, certification_type, certification_name,
  certification_number, issued_at, verification_status
) VALUES
-- 小林亜希の資格
('cert-001', 'sitter-test-001', 'tokyo_babysitter_training', '東京都ベビーシッター利用支援事業研修', 'TKY-2024-00123', '2024-03-15', 'verified'),
('cert-002', 'sitter-test-001', 'st', '言語聴覚士免許', 'ST-12345', '2015-04-01', 'verified'),
('cert-003', 'sitter-test-001', 'nursery_teacher', '保育士資格', 'HI-98765', '2013-03-20', 'verified'),
-- 田中健太の資格
('cert-004', 'sitter-test-002', 'tokyo_babysitter_training', '東京都ベビーシッター利用支援事業研修', 'TKY-2024-00456', '2024-04-20', 'verified'),
('cert-005', 'sitter-test-002', 'pt', '理学療法士免許', 'PT-23456', '2016-04-01', 'verified'),
-- 山本美咲の資格
('cert-006', 'sitter-test-003', 'ot', '作業療法士免許', 'OT-34567', '2018-04-01', 'verified'),
-- 佐藤由美の資格
('cert-007', 'sitter-test-004', 'tokyo_babysitter_training', '東京都ベビーシッター利用支援事業研修', 'TKY-2024-00789', '2024-02-10', 'verified'),
('cert-008', 'sitter-test-004', 'nurse', '看護師免許', 'NS-45678', '2012-04-01', 'verified'),
('cert-009', 'sitter-test-004', 'nursery_teacher', '保育士資格', 'HI-11111', '2014-03-20', 'verified'),
-- 鈴木恵理の資格
('cert-010', 'sitter-test-005', 'psychologist', '臨床心理士', 'CP-56789', '2017-04-01', 'verified'),
-- 伊藤さくらの資格
('cert-011', 'sitter-test-006', 'tokyo_babysitter_training', '東京都ベビーシッター利用支援事業研修', 'TKY-2024-00111', '2024-05-01', 'verified'),
('cert-012', 'sitter-test-006', 'nursery_teacher', '保育士資格', 'HI-22222', '2019-03-20', 'verified'),
('cert-013', 'sitter-test-006', 'first_aid', '救急救命講習', NULL, '2024-06-01', 'verified')
ON CONFLICT (id) DO NOTHING;

-- 3. シッター予約サンプル（dev-client-user-001とdev-test-child-001を使用）
INSERT INTO sitter_bookings (
  id, sitter_id, client_user_id, child_id,
  booking_date, start_time, end_time,
  location_address, location_notes,
  hourly_rate, estimated_hours, estimated_total,
  subsidy_eligible, subsidy_amount, client_payment,
  status, client_memo
) VALUES
-- 確定済みの予約
(
  'booking-001',
  'sitter-test-001',
  'dev-client-user-001',
  'dev-test-child-001',
  CURRENT_DATE + INTERVAL '2 days',
  '10:00',
  '13:00',
  '東京都港区芝公園3-1-1',
  'マンション5F',
  3500,
  3.0,
  10500,
  true,
  7500,
  3000,
  'confirmed',
  '人見知りがありますが、電車遊びが大好きです。言葉の促しをお願いします。'
),
(
  'booking-002',
  'sitter-test-004',
  'dev-client-user-001',
  'dev-test-child-001',
  CURRENT_DATE + INTERVAL '5 days',
  '14:00',
  '18:00',
  '東京都港区芝公園3-1-1',
  'マンション5F',
  4000,
  4.0,
  16000,
  true,
  10000,
  6000,
  'confirmed',
  '医療的ケアの対応をお願いします。'
),
-- 申請中の予約
(
  'booking-003',
  'sitter-test-002',
  'dev-client-user-001',
  'dev-test-child-001',
  CURRENT_DATE + INTERVAL '7 days',
  '09:00',
  '12:00',
  '東京都新宿区西新宿1-1-1',
  NULL,
  3200,
  3.0,
  9600,
  true,
  7500,
  2100,
  'pending',
  '運動発達の支援をお願いしたいです。'
),
-- 完了済みの予約（報告書未作成）
(
  'booking-004',
  'sitter-test-001',
  'dev-client-user-001',
  'dev-test-child-001',
  CURRENT_DATE - INTERVAL '3 days',
  '10:00',
  '13:00',
  '東京都港区芝公園3-1-1',
  'マンション5F',
  3500,
  3.0,
  10500,
  true,
  7500,
  3000,
  'completed',
  '前回と同様のケアをお願いします。'
)
ON CONFLICT (id) DO NOTHING;

-- 4. レビューサンプル
INSERT INTO sitter_reviews (
  id, booking_id, sitter_id, client_user_id,
  rating, comment,
  communication_rating, expertise_rating, punctuality_rating,
  is_public
) VALUES
(
  'review-001',
  'booking-004',
  'sitter-test-001',
  'dev-client-user-001',
  5,
  '子供がとても楽しそうに過ごしていました。言葉かけも丁寧で、発語が増えたように感じます。また是非お願いしたいです。',
  5,
  5,
  5,
  true
)
ON CONFLICT (id) DO NOTHING;

-- 確認用クエリ
SELECT
  sp.display_name,
  sp.professions,
  sp.hourly_rate,
  sp.is_tokyo_certified,
  sp.rating_average,
  sp.total_bookings
FROM sitter_profiles sp
WHERE sp.is_public = true
ORDER BY sp.rating_average DESC;
