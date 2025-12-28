-- ============================================
-- pocopoco施設の施設IDを5桁のランダムな番号に更新
-- ============================================

DO $$
DECLARE
  v_facility_id TEXT;
  v_new_facility_code TEXT;
  v_existing_code TEXT;
  v_update_count INTEGER;
BEGIN
  -- 既存のfacility_settingsからfacility_idを取得（施設名がpocopocoのもの）
  SELECT facility_id INTO v_facility_id
  FROM facility_settings
  WHERE facility_name = 'pocopoco'
  LIMIT 1;

  RAISE NOTICE 'facility_settingsから取得したfacility_id: %', v_facility_id;

  -- 施設が見つからない場合は、facilitiesテーブルから検索
  IF v_facility_id IS NULL THEN
    SELECT id INTO v_facility_id
    FROM facilities
    WHERE name = 'pocopoco'
    LIMIT 1;
    
    RAISE NOTICE 'facilitiesテーブルから取得したfacility_id: %', v_facility_id;
  END IF;

  -- 施設が見つからない場合はエラー
  IF v_facility_id IS NULL THEN
    RAISE EXCEPTION 'pocopoco施設が見つかりません';
  END IF;

  -- 既存の施設コードを確認
  SELECT code INTO v_existing_code
  FROM facilities
  WHERE id = v_facility_id;

  RAISE NOTICE '既存の施設コード: %', v_existing_code;
  RAISE NOTICE '施設ID: %', v_facility_id;

  -- 5桁のランダムな番号を生成（10000-99999）
  -- 既存のコードと重複しないようにチェック
  LOOP
    v_new_facility_code := LPAD((FLOOR(RANDOM() * 90000) + 10000)::TEXT, 5, '0');
    
    -- 既に存在するコードでないか確認
    IF NOT EXISTS (
      SELECT 1 FROM facilities WHERE code = v_new_facility_code AND id != v_facility_id
    ) THEN
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '生成した新しい施設コード: %', v_new_facility_code;

  -- 施設コードを更新
  UPDATE facilities
  SET code = v_new_facility_code, updated_at = NOW()
  WHERE id = v_facility_id;

  GET DIAGNOSTICS v_update_count = ROW_COUNT;

  IF v_update_count = 0 THEN
    RAISE EXCEPTION '施設コードの更新に失敗しました。施設IDが正しいか確認してください。';
  END IF;

  RAISE NOTICE '施設IDを更新しました！';
  RAISE NOTICE '更新された行数: %', v_update_count;
  RAISE NOTICE '施設ID: %', v_facility_id;
  RAISE NOTICE '旧施設コード: %', v_existing_code;
  RAISE NOTICE '新施設コード: %', v_new_facility_code;
  RAISE NOTICE '';
  RAISE NOTICE '※ ログイン時に使用する施設IDは「%」です。', v_new_facility_code;
  
  -- 更新結果を確認
  SELECT code INTO v_existing_code
  FROM facilities
  WHERE id = v_facility_id;
  
  RAISE NOTICE '更新後の確認: 施設コード = %', v_existing_code;
END $$;

