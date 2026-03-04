-- platform_name を co-shien から Roots に変更
UPDATE system_config
SET value = 'Roots'
WHERE key = 'platform_name' AND value = 'co-shien';
