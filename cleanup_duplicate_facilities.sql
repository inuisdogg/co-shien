-- ============================================
-- 重複しているpocopoco施設のレコードを整理
-- 正しい方のレコードだけを残す
-- ============================================

DO $$
DECLARE
  v_correct_facility_id TEXT;
  v_wrong_facility_id TEXT;
  v_correct_facility_code TEXT;
  v_facility_1_id TEXT := 'facility-1';
  v_pocopoco_001_id TEXT := 'pocopoco-001';
  v_facility_1_count INTEGER;
  v_pocopoco_001_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '重複施設レコードの整理を開始します';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 1. 各施設IDの使用状況を確認
  -- facility_settingsテーブル
  SELECT COUNT(*) INTO v_facility_1_count
  FROM facility_settings
  WHERE facility_id = v_facility_1_id;
  
  SELECT COUNT(*) INTO v_pocopoco_001_count
  FROM facility_settings
  WHERE facility_id = v_pocopoco_001_id;

  RAISE NOTICE 'facility_settingsテーブル:';
  RAISE NOTICE '  facility-1: % 件', v_facility_1_count;
  RAISE NOTICE '  pocopoco-001: % 件', v_pocopoco_001_count;

  -- usersテーブル
  SELECT COUNT(*) INTO v_facility_1_count
  FROM users
  WHERE facility_id = v_facility_1_id;
  
  SELECT COUNT(*) INTO v_pocopoco_001_count
  FROM users
  WHERE facility_id = v_pocopoco_001_id;

  RAISE NOTICE 'usersテーブル:';
  RAISE NOTICE '  facility-1: % 件', v_facility_1_count;
  RAISE NOTICE '  pocopoco-001: % 件', v_pocopoco_001_count;

  -- staffテーブル
  SELECT COUNT(*) INTO v_facility_1_count
  FROM staff
  WHERE facility_id = v_facility_1_id;
  
  SELECT COUNT(*) INTO v_pocopoco_001_count
  FROM staff
  WHERE facility_id = v_pocopoco_001_id;

  RAISE NOTICE 'staffテーブル:';
  RAISE NOTICE '  facility-1: % 件', v_facility_1_count;
  RAISE NOTICE '  pocopoco-001: % 件', v_pocopoco_001_count;
  RAISE NOTICE '';

  -- 2. どちらが正しいレコードかを判定
  -- より多くの関連データがある方を正しいレコードとする
  -- または、updated_atが新しい方を正しいレコードとする
  
  -- まず、関連データの数を比較
  SELECT 
    COUNT(DISTINCT fs.facility_id) + 
    COUNT(DISTINCT u.id) + 
    COUNT(DISTINCT s.id)
  INTO v_facility_1_count
  FROM facilities f
  LEFT JOIN facility_settings fs ON fs.facility_id = f.id
  LEFT JOIN users u ON u.facility_id = f.id
  LEFT JOIN staff s ON s.facility_id = f.id
  WHERE f.id = v_facility_1_id;

  SELECT 
    COUNT(DISTINCT fs.facility_id) + 
    COUNT(DISTINCT u.id) + 
    COUNT(DISTINCT s.id)
  INTO v_pocopoco_001_count
  FROM facilities f
  LEFT JOIN facility_settings fs ON fs.facility_id = f.id
  LEFT JOIN users u ON u.facility_id = f.id
  LEFT JOIN staff s ON s.facility_id = f.id
  WHERE f.id = v_pocopoco_001_id;

  RAISE NOTICE '関連データの総数:';
  RAISE NOTICE '  facility-1: % 件', v_facility_1_count;
  RAISE NOTICE '  pocopoco-001: % 件', v_pocopoco_001_count;

  -- 正しいレコードを決定（関連データが多い方、またはpocopoco-001を優先）
  IF v_pocopoco_001_count > v_facility_1_count THEN
    v_correct_facility_id := v_pocopoco_001_id;
    v_wrong_facility_id := v_facility_1_id;
  ELSIF v_facility_1_count > v_pocopoco_001_count THEN
    v_correct_facility_id := v_facility_1_id;
    v_wrong_facility_id := v_pocopoco_001_id;
  ELSE
    -- 同数の場合は、updated_atが新しい方を優先
    DECLARE
      v_facility_1_updated TIMESTAMPTZ;
      v_pocopoco_001_updated TIMESTAMPTZ;
    BEGIN
      SELECT updated_at INTO v_facility_1_updated
      FROM facilities
      WHERE id = v_facility_1_id;
      
      SELECT updated_at INTO v_pocopoco_001_updated
      FROM facilities
      WHERE id = v_pocopoco_001_id;
      
      IF v_pocopoco_001_updated > v_facility_1_updated THEN
        v_correct_facility_id := v_pocopoco_001_id;
        v_wrong_facility_id := v_facility_1_id;
      ELSE
        v_correct_facility_id := v_facility_1_id;
        v_wrong_facility_id := v_pocopoco_001_id;
      END IF;
    END;
  END IF;

  -- 正しい施設コードを取得
  SELECT code INTO v_correct_facility_code
  FROM facilities
  WHERE id = v_correct_facility_id;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '判定結果:';
  RAISE NOTICE '  正しいレコード: %', v_correct_facility_id;
  RAISE NOTICE '  削除するレコード: %', v_wrong_facility_id;
  RAISE NOTICE '  施設コード: %', v_correct_facility_code;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 3. 間違ったレコードに関連データがある場合、正しいレコードに移行
  -- facility_settings（既に正しいレコードに設定がある場合は削除、ない場合は移行）
  IF EXISTS (SELECT 1 FROM facility_settings WHERE facility_id = v_correct_facility_id) THEN
    -- 正しいレコードに既に設定がある場合は、間違ったレコードの設定を削除
    DELETE FROM facility_settings
    WHERE facility_id = v_wrong_facility_id;
    RAISE NOTICE 'facility_settings: 正しいレコードに既に設定があるため、間違ったレコードの設定を削除しました';
  ELSE
    -- 正しいレコードに設定がない場合は移行
    UPDATE facility_settings
    SET facility_id = v_correct_facility_id, updated_at = NOW()
    WHERE facility_id = v_wrong_facility_id;
    RAISE NOTICE 'facility_settings: 間違ったレコードの設定を正しいレコードに移行しました';
  END IF;

  -- users（重複チェックなし、複数のユーザーが存在可能）
  UPDATE users
  SET facility_id = v_correct_facility_id, updated_at = NOW()
  WHERE facility_id = v_wrong_facility_id;
  
  IF FOUND THEN
    RAISE NOTICE 'users: 間違ったレコードのユーザーを正しいレコードに移行しました';
  END IF;

  -- staff（重複チェックなし、複数のスタッフが存在可能）
  UPDATE staff
  SET facility_id = v_correct_facility_id, updated_at = NOW()
  WHERE facility_id = v_wrong_facility_id;
  
  IF FOUND THEN
    RAISE NOTICE 'staff: 間違ったレコードのスタッフを正しいレコードに移行しました';
  END IF;

  RAISE NOTICE '関連データの移行が完了しました';

  -- 4. 間違ったレコードを削除
  DELETE FROM facilities
  WHERE id = v_wrong_facility_id;

  RAISE NOTICE '間違ったレコードを削除しました';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '整理が完了しました！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '正しい施設ID: %', v_correct_facility_id;
  RAISE NOTICE '施設コード: %', v_correct_facility_code;
  RAISE NOTICE '';
  RAISE NOTICE '※ ログイン時に使用する施設IDは「%」です。', v_correct_facility_code;
END $$;

