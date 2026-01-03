-- ============================================
-- pocopoco施設の施設IDを5桁のランダムな番号に強制更新
-- ============================================
-- このスクリプトは、facilitiesテーブルに直接アクセスして
-- 施設名が「pocopoco」の施設のコードを強制的に更新します

DO $$
DECLARE
  v_facility_id TEXT;
  v_new_facility_code TEXT;
  v_existing_code TEXT;
  v_update_count INTEGER;
BEGIN
  -- facilitiesテーブルから直接検索（nameで検索）
  SELECT id, code INTO v_facility_id, v_existing_code
  FROM facilities
  WHERE name = 'pocopoco'
  LIMIT 1;

  RAISE NOTICE '検索結果:';
  RAISE NOTICE '  施設ID: %', v_facility_id;
  RAISE NOTICE '  現在の施設コード: %', v_existing_code;

  -- 施設が見つからない場合はエラー
  IF v_facility_id IS NULL THEN
    RAISE EXCEPTION 'pocopoco施設が見つかりません。facilitiesテーブルにname=''pocopoco''のレコードが存在するか確認してください。';
  END IF;

  -- 5桁のランダムな番号を生成（10000-99999）
  -- 既存のコードと重複しないようにチェック
  LOOP
    v_new_facility_code := LPAD((FLOOR(RANDOM() * 90000) + 10000)::TEXT, 5, '0');
    
    -- 既に存在するコードでないか確認（自分自身は除外）
    IF NOT EXISTS (
      SELECT 1 FROM facilities WHERE code = v_new_facility_code AND id != v_facility_id
    ) THEN
      EXIT;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '新しい施設コードを生成: %', v_new_facility_code;

  -- 施設コードを強制的に更新
  UPDATE facilities
  SET code = v_new_facility_code, updated_at = NOW()
  WHERE id = v_facility_id;

  GET DIAGNOSTICS v_update_count = ROW_COUNT;

  IF v_update_count = 0 THEN
    RAISE EXCEPTION '施設コードの更新に失敗しました。UPDATE文が実行されましたが、行が更新されませんでした。';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '施設コードを更新しました！';
  RAISE NOTICE '========================================';
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
  
  RAISE NOTICE '';
  RAISE NOTICE '更新後の確認:';
  RAISE NOTICE '  施設ID: %', v_facility_id;
  RAISE NOTICE '  施設コード: %', v_existing_code;
  
  IF v_existing_code = v_new_facility_code THEN
    RAISE NOTICE '✓ 更新が正常に完了しました！';
  ELSE
    RAISE WARNING '⚠ 更新後のコードが期待値と異なります。確認してください。';
  END IF;
END $$;


