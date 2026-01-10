-- サンプルスケジュールデータの追加
-- schedulesテーブルのidはTEXT型（NOT NULL）

-- まず既存のテスト児童のスケジュールを削除（重複防止）
DELETE FROM schedules WHERE child_id IN ('dev-test-child-001', 'dev-test-child-002');

-- テスト太郎のスケジュール（今月の平日）
DO $$
DECLARE
  current_day DATE;
  slot_val TEXT;
  schedule_id TEXT;
BEGIN
  -- 今月の1日から
  current_day := date_trunc('month', CURRENT_DATE)::DATE;

  WHILE current_day <= CURRENT_DATE + INTERVAL '14 days' LOOP
    -- 土日は除外
    IF EXTRACT(DOW FROM current_day) NOT IN (0, 6) THEN
      -- 午前スロット
      slot_val := 'AM';
      schedule_id := 'sch-' || gen_random_uuid()::TEXT;

      INSERT INTO schedules (
        id,
        facility_id,
        child_id,
        child_name,
        date,
        slot,
        has_pickup,
        has_dropoff,
        service_status,
        start_time,
        end_time,
        calculated_time
      ) VALUES (
        schedule_id,
        'facility-demo-001',
        'dev-test-child-001',
        'テスト太郎',
        current_day,
        slot_val,
        true,
        false,
        CASE WHEN current_day <= CURRENT_DATE THEN '利用' ELSE NULL END,
        CASE WHEN current_day <= CURRENT_DATE THEN '09:00'::TIME ELSE NULL END,
        CASE WHEN current_day <= CURRENT_DATE THEN '12:00'::TIME ELSE NULL END,
        CASE WHEN current_day <= CURRENT_DATE THEN 3.0 ELSE NULL END
      );

      -- 午後スロット（火曜と木曜のみ）
      IF EXTRACT(DOW FROM current_day) IN (2, 4) THEN
        slot_val := 'PM';
        schedule_id := 'sch-' || gen_random_uuid()::TEXT;

        INSERT INTO schedules (
          id,
          facility_id,
          child_id,
          child_name,
          date,
          slot,
          has_pickup,
          has_dropoff,
          service_status,
          start_time,
          end_time,
          calculated_time
        ) VALUES (
          schedule_id,
          'facility-demo-001',
          'dev-test-child-001',
          'テスト太郎',
          current_day,
          slot_val,
          false,
          true,
          CASE WHEN current_day <= CURRENT_DATE THEN '利用' ELSE NULL END,
          CASE WHEN current_day <= CURRENT_DATE THEN '13:00'::TIME ELSE NULL END,
          CASE WHEN current_day <= CURRENT_DATE THEN '17:00'::TIME ELSE NULL END,
          CASE WHEN current_day <= CURRENT_DATE THEN 4.0 ELSE NULL END
        );
      END IF;
    END IF;

    current_day := current_day + INTERVAL '1 day';
  END LOOP;
END $$;

-- テスト花子のスケジュール（月水金のみ）
DO $$
DECLARE
  current_day DATE;
  schedule_id TEXT;
BEGIN
  -- 今月の1日から
  current_day := date_trunc('month', CURRENT_DATE)::DATE;

  WHILE current_day <= CURRENT_DATE + INTERVAL '14 days' LOOP
    -- 月水金のみ
    IF EXTRACT(DOW FROM current_day) IN (1, 3, 5) THEN
      schedule_id := 'sch-' || gen_random_uuid()::TEXT;

      INSERT INTO schedules (
        id,
        facility_id,
        child_id,
        child_name,
        date,
        slot,
        has_pickup,
        has_dropoff,
        service_status,
        start_time,
        end_time,
        calculated_time
      ) VALUES (
        schedule_id,
        'facility-demo-001',
        'dev-test-child-002',
        'テスト花子',
        current_day,
        'PM',
        true,
        false,
        CASE WHEN current_day <= CURRENT_DATE THEN '利用' ELSE NULL END,
        CASE WHEN current_day <= CURRENT_DATE THEN '14:00'::TIME ELSE NULL END,
        CASE WHEN current_day <= CURRENT_DATE THEN '17:00'::TIME ELSE NULL END,
        CASE WHEN current_day <= CURRENT_DATE THEN 3.0 ELSE NULL END
      );
    END IF;

    current_day := current_day + INTERVAL '1 day';
  END LOOP;
END $$;

-- 過去の欠席データも追加（リアリティのため）
INSERT INTO schedules (
  id,
  facility_id,
  child_id,
  child_name,
  date,
  slot,
  has_pickup,
  has_dropoff,
  service_status,
  absence_reason
) VALUES (
  'sch-absence-001',
  'facility-demo-001',
  'dev-test-child-001',
  'テスト太郎',
  CURRENT_DATE - INTERVAL '7 days',
  'AM',
  false,
  false,
  '欠席(加算なし)',
  '体調不良のため'
);
