-- =============================================
-- 求人閲覧機能の拡張
-- job_postings に image_url 追加
-- job_applications に面接形式フィールド追加
-- job_favorites テーブル作成
-- デモデータ投入
-- =============================================

-- Add image_url to job_postings
ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add interview fields to job_applications
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_format TEXT CHECK (interview_format IN ('in_person', 'online', 'phone'));
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_location TEXT;
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_meeting_url TEXT;

-- Create job_favorites table
CREATE TABLE IF NOT EXISTS job_favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_posting_id TEXT NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, job_posting_id)
);

CREATE INDEX IF NOT EXISTS idx_job_favorites_user_id ON job_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_job_favorites_job_posting_id ON job_favorites(job_posting_id);

ALTER TABLE job_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_favorites_select" ON job_favorites FOR SELECT USING (true);
CREATE POLICY "job_favorites_insert" ON job_favorites FOR INSERT WITH CHECK (true);
CREATE POLICY "job_favorites_update" ON job_favorites FOR UPDATE USING (true);
CREATE POLICY "job_favorites_delete" ON job_favorites FOR DELETE USING (true);

-- =============================================
-- デモ施設データ
-- =============================================

INSERT INTO facilities (id, name, code, created_at, updated_at) VALUES
  ('facility-job-demo-001', 'ひまわり児童発達支援センター', 'HJOB01', NOW(), NOW()),
  ('facility-job-demo-002', 'さくら放課後等デイサービス', 'SJOB02', NOW(), NOW()),
  ('facility-job-demo-003', 'にじいろキッズ', 'NJOB03', NOW(), NOW()),
  ('facility-job-demo-004', 'こころケアステーション', 'KJOB04', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- デモ求人データ（7件）
-- =============================================

INSERT INTO job_postings (id, facility_id, job_type, title, description, required_qualifications, preferred_qualifications, experience_years_min, employment_type, work_location, work_hours, salary_min, salary_max, salary_type, benefits, annual_salary_estimate, spots_needed, status, published_at) VALUES
  (
    'job-demo-001',
    'facility-job-demo-001',
    'full_time',
    '保育士（正社員）子どもの発達を一緒に支えませんか？',
    E'子どもたちの「できた！」を一緒に喜べる仲間を募集しています。\n\n当施設では、一人ひとりの発達段階に合わせた個別支援を大切にしています。経験豊富なスタッフが丁寧にサポートするので、児童発達支援が初めての方も安心してご応募ください。\n\n【仕事内容】\n・個別支援計画に基づく療育活動\n・保護者との連絡・相談対応\n・日々の記録作成\n・送迎業務（運転免許があれば尚可）',
    '{NURSERY_TEACHER}',
    '{CHILD_INSTRUCTOR}',
    1,
    '常勤',
    '東京都世田谷区',
    '9:00〜18:00',
    220000,
    280000,
    'monthly',
    '社保完備、交通費支給、研修制度充実、賞与年2回',
    3360000,
    2,
    'published',
    NOW()
  ),
  (
    'job-demo-002',
    'facility-job-demo-002',
    'full_time',
    '児童指導員 正社員募集｜放課後デイで子どもの成長をサポート',
    E'放課後等デイサービスで、学齢期の子どもたちの放課後をサポートするスタッフを募集します。\n\n【仕事内容】\n・放課後の学習支援・遊びの見守り\n・季節のイベント企画・運営\n・個別支援計画の作成補助\n・保護者対応\n\n未経験でも先輩スタッフが丁寧に教えます。子どもが好きな方、大歓迎！',
    '{CHILD_INSTRUCTOR}',
    '{SOCIAL_WORKER,NURSERY_TEACHER}',
    0,
    '常勤',
    '東京都杉並区',
    '10:00〜19:00',
    200000,
    260000,
    'monthly',
    '社保完備、交通費全額支給、資格取得支援制度',
    2760000,
    1,
    'published',
    NOW()
  ),
  (
    'job-demo-003',
    'facility-job-demo-001',
    'part_time',
    '言語聴覚士（ST）パート｜週2日〜OK',
    E'言語聴覚療法の専門知識を活かして、子どもたちの言語発達をサポートしませんか？\n\n週2日からOK、ブランクがある方も歓迎します。\n\n【仕事内容】\n・言語聴覚療法の実施\n・評価・報告書作成\n・他スタッフとの連携',
    '{ST}',
    '{}',
    0,
    '非常勤',
    '東京都世田谷区',
    '週2〜4日、1日4時間〜相談可',
    1500,
    2000,
    'hourly',
    '交通費支給、研修参加費補助',
    NULL,
    1,
    'published',
    NOW()
  ),
  (
    'job-demo-004',
    'facility-job-demo-003',
    'part_time',
    '放課後デイ 保育補助パート｜未経験・無資格OK',
    E'資格がなくても大丈夫！子どもたちと楽しい放課後を過ごしましょう。\n\n主婦(夫)の方、学生さんも歓迎です。\n\n【仕事内容】\n・子どもの見守り・遊び相手\n・おやつの準備・片付け\n・施設内の清掃',
    '{}',
    '{NURSERY_TEACHER}',
    0,
    '非常勤',
    '東京都練馬区',
    '14:00〜18:00（平日）',
    1100,
    1300,
    'hourly',
    '交通費支給、制服貸与',
    NULL,
    1,
    'published',
    NOW()
  ),
  (
    'job-demo-005',
    'facility-job-demo-004',
    'spot',
    '急募！保育士ヘルパー（スポット勤務）',
    E'急なスタッフ不足時にヘルプに入っていただける保育士さんを募集！\n\n空いている日だけでOK。あなたのペースで働けます。\n\n【仕事内容】\n・通常療育のサポート\n・送迎補助\n・記録補助',
    '{NURSERY_TEACHER}',
    '{}',
    0,
    'スポット',
    '東京都新宿区',
    'シフトによる',
    1500,
    1500,
    'hourly',
    NULL,
    NULL,
    1,
    'published',
    NOW()
  ),
  (
    'job-demo-006',
    'facility-job-demo-003',
    'spot',
    'イベント補助スタッフ（単発OK）',
    E'季節イベントや外出活動の際にお手伝いいただけるスタッフを募集します。\n\n未経験OK！楽しいイベントを一緒に作りましょう。\n\n【仕事内容】\n・イベント準備・設営\n・子どもの見守り・安全確保\n・片付け',
    '{}',
    '{}',
    0,
    'スポット',
    '東京都練馬区',
    'イベント日程による',
    1200,
    1200,
    'hourly',
    NULL,
    NULL,
    1,
    'published',
    NOW()
  ),
  (
    'job-demo-007',
    'facility-job-demo-002',
    'full_time',
    '作業療法士（OT）正社員｜発達支援に興味がある方',
    E'作業療法の視点から、子どもたちの日常生活動作や感覚統合の支援を行います。\n\n【仕事内容】\n・作業療法評価・プログラム立案\n・個別・小集団での療育活動\n・保護者への助言・指導\n・多職種連携カンファレンス参加\n\n経験2年以上の方を求めていますが、児童分野未経験でも病院等での臨床経験があればOKです。',
    '{OT}',
    '{PT}',
    2,
    '常勤',
    '東京都杉並区',
    '9:00〜18:00',
    250000,
    320000,
    'monthly',
    '社保完備、退職金制度、住宅手当あり、有給消化率90%以上',
    3420000,
    1,
    'published',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- デモ スポットワークシフト
-- job-demo-005: 保育士ヘルパー（4シフト × 7日 = 28件）
-- job-demo-006: イベント補助（3シフト × 7日 = 21件）
-- =============================================

-- job-demo-005 shifts (nursery helper, hourly_rate=1500)
INSERT INTO spot_work_shifts (id, job_posting_id, shift_date, start_time, end_time, hourly_rate, spots_available, status) VALUES
  ('shift-demo-001', 'job-demo-005', '2026-03-01', '09:00', '13:00', 1500, 2, 'open'),
  ('shift-demo-002', 'job-demo-005', '2026-03-01', '13:00', '17:00', 1500, 3, 'open'),
  ('shift-demo-003', 'job-demo-005', '2026-03-02', '09:00', '13:00', 1500, 2, 'open'),
  ('shift-demo-004', 'job-demo-005', '2026-03-02', '14:00', '18:00', 1500, 2, 'open'),
  ('shift-demo-005', 'job-demo-005', '2026-03-03', '09:00', '13:00', 1500, 3, 'open'),
  ('shift-demo-006', 'job-demo-005', '2026-03-03', '13:00', '17:00', 1500, 2, 'open'),
  ('shift-demo-007', 'job-demo-005', '2026-03-04', '09:00', '13:00', 1500, 2, 'open'),
  ('shift-demo-008', 'job-demo-005', '2026-03-04', '14:00', '18:00', 1500, 3, 'open'),
  ('shift-demo-009', 'job-demo-005', '2026-03-05', '09:00', '13:00', 1500, 2, 'open'),
  ('shift-demo-010', 'job-demo-005', '2026-03-05', '13:00', '17:00', 1500, 2, 'open'),
  ('shift-demo-011', 'job-demo-005', '2026-03-06', '09:00', '13:00', 1500, 3, 'open'),
  ('shift-demo-012', 'job-demo-005', '2026-03-06', '14:00', '18:00', 1500, 2, 'open'),
  ('shift-demo-013', 'job-demo-005', '2026-03-07', '09:00', '13:00', 1500, 2, 'open'),
  ('shift-demo-014', 'job-demo-005', '2026-03-07', '13:00', '17:00', 1500, 3, 'open')
ON CONFLICT (id) DO NOTHING;

-- job-demo-006 shifts (event staff, hourly_rate=1200)
INSERT INTO spot_work_shifts (id, job_posting_id, shift_date, start_time, end_time, hourly_rate, spots_available, status) VALUES
  ('shift-demo-015', 'job-demo-006', '2026-03-01', '09:00', '12:00', 1200, 3, 'open'),
  ('shift-demo-016', 'job-demo-006', '2026-03-01', '13:00', '16:00', 1200, 2, 'open'),
  ('shift-demo-017', 'job-demo-006', '2026-03-01', '10:00', '15:00', 1200, 2, 'open'),
  ('shift-demo-018', 'job-demo-006', '2026-03-02', '09:00', '12:00', 1200, 3, 'open'),
  ('shift-demo-019', 'job-demo-006', '2026-03-02', '13:00', '16:00', 1200, 2, 'open'),
  ('shift-demo-020', 'job-demo-006', '2026-03-02', '10:00', '15:00', 1200, 3, 'open'),
  ('shift-demo-021', 'job-demo-006', '2026-03-03', '09:00', '12:00', 1200, 2, 'open'),
  ('shift-demo-022', 'job-demo-006', '2026-03-03', '13:00', '16:00', 1200, 3, 'open'),
  ('shift-demo-023', 'job-demo-006', '2026-03-03', '10:00', '15:00', 1200, 2, 'open'),
  ('shift-demo-024', 'job-demo-006', '2026-03-04', '09:00', '12:00', 1200, 3, 'open'),
  ('shift-demo-025', 'job-demo-006', '2026-03-04', '13:00', '16:00', 1200, 2, 'open'),
  ('shift-demo-026', 'job-demo-006', '2026-03-04', '10:00', '15:00', 1200, 2, 'open'),
  ('shift-demo-027', 'job-demo-006', '2026-03-05', '09:00', '12:00', 1200, 2, 'open'),
  ('shift-demo-028', 'job-demo-006', '2026-03-05', '13:00', '16:00', 1200, 3, 'open'),
  ('shift-demo-029', 'job-demo-006', '2026-03-05', '10:00', '15:00', 1200, 2, 'open'),
  ('shift-demo-030', 'job-demo-006', '2026-03-06', '09:00', '12:00', 1200, 3, 'open'),
  ('shift-demo-031', 'job-demo-006', '2026-03-06', '13:00', '16:00', 1200, 2, 'open'),
  ('shift-demo-032', 'job-demo-006', '2026-03-06', '10:00', '15:00', 1200, 3, 'open'),
  ('shift-demo-033', 'job-demo-006', '2026-03-07', '09:00', '12:00', 1200, 2, 'open'),
  ('shift-demo-034', 'job-demo-006', '2026-03-07', '13:00', '16:00', 1200, 3, 'open'),
  ('shift-demo-035', 'job-demo-006', '2026-03-07', '10:00', '15:00', 1200, 2, 'open')
ON CONFLICT (id) DO NOTHING;
