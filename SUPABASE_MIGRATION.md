# Supabase移行ガイド

このドキュメントは、現在のローカル状態管理からSupabaseへの移行方法を説明します。

## 現在の実装

現在、データは`useFacilityData`フック内で`useState`を使用してローカル状態管理されています。

## Supabase移行手順

### 1. Supabaseプロジェクトのセットアップ

1. Supabaseプロジェクトを作成
2. 以下のテーブルを作成：

```sql
-- 施設情報設定テーブル
CREATE TABLE facility_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facility_id TEXT NOT NULL,
  regular_holidays INTEGER[] DEFAULT ARRAY[0],
  custom_holidays TEXT[] DEFAULT ARRAY[]::TEXT[],
  business_hours JSONB NOT NULL DEFAULT '{"AM": {"start": "09:00", "end": "12:00"}, "PM": {"start": "13:00", "end": "18:00"}}',
  capacity JSONB NOT NULL DEFAULT '{"AM": 10, "PM": 10}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(facility_id)
);

-- 児童テーブル
CREATE TABLE children (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  name TEXT NOT NULL,
  age INTEGER,
  guardian_name TEXT,
  guardian_relationship TEXT,
  beneficiary_number TEXT,
  grant_days INTEGER,
  contract_days INTEGER,
  address TEXT,
  phone TEXT,
  email TEXT,
  doctor_name TEXT,
  doctor_clinic TEXT,
  school_name TEXT,
  pattern TEXT,
  needs_pickup BOOLEAN DEFAULT false,
  needs_dropoff BOOLEAN DEFAULT false,
  pickup_location TEXT,
  dropoff_location TEXT,
  contract_status TEXT NOT NULL,
  contract_start_date DATE,
  contract_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- スケジュールテーブル
CREATE TABLE schedules (
  id BIGSERIAL PRIMARY KEY,
  facility_id TEXT NOT NULL,
  date DATE NOT NULL,
  child_id TEXT NOT NULL,
  child_name TEXT NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('AM', 'PM')),
  has_pickup BOOLEAN DEFAULT false,
  has_dropoff BOOLEAN DEFAULT false,
  staff_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX idx_schedules_facility_date ON schedules(facility_id, date);
CREATE INDEX idx_children_facility ON children(facility_id);
```

### 2. Supabaseクライアントのセットアップ

```bash
npm install @supabase/supabase-js
```

`.env.local`ファイルを作成：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabaseクライアントの作成

`src/lib/supabase.ts`を作成：

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 4. useFacilityDataフックの更新

`src/hooks/useFacilityData.ts`を更新して、Supabaseからデータを取得するように変更：

```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { FacilitySettings } from '@/types';

export const useFacilityData = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null);
  const [loading, setLoading] = useState(true);

  // 施設情報設定を取得
  useEffect(() => {
    if (!facilityId) return;

    const fetchFacilitySettings = async () => {
      const { data, error } = await supabase
        .from('facility_settings')
        .select('*')
        .eq('facility_id', facilityId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116は「行が見つからない」エラー
        console.error('Error fetching facility settings:', error);
        return;
      }

      if (data) {
        // データベースのスネークケースをキャメルケースに変換
        setFacilitySettings({
          id: data.id,
          facilityId: data.facility_id,
          regularHolidays: data.regular_holidays || [0],
          customHolidays: data.custom_holidays || [],
          businessHours: data.business_hours,
          capacity: data.capacity,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } else {
        // デフォルト設定を作成
        const defaultSettings: FacilitySettings = {
          id: crypto.randomUUID(),
          facilityId,
          regularHolidays: [0],
          customHolidays: [],
          businessHours: {
            AM: { start: '09:00', end: '12:00' },
            PM: { start: '13:00', end: '18:00' },
          },
          capacity: { AM: 10, PM: 10 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setFacilitySettings(defaultSettings);
      }
      setLoading(false);
    };

    fetchFacilitySettings();
  }, [facilityId]);

  // 施設情報設定を更新
  const updateFacilitySettings = async (settings: Partial<FacilitySettings>) => {
    if (!facilitySettings || !facilityId) return;

    const updatedSettings = {
      ...facilitySettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('facility_settings')
      .upsert({
        id: updatedSettings.id,
        facility_id: facilityId,
        regular_holidays: updatedSettings.regularHolidays,
        custom_holidays: updatedSettings.customHolidays,
        business_hours: updatedSettings.businessHours,
        capacity: updatedSettings.capacity,
        updated_at: updatedSettings.updatedAt,
      })
      .eq('facility_id', facilityId)
      .select()
      .single();

    if (error) {
      console.error('Error updating facility settings:', error);
      return;
    }

    // データベースのスネークケースをキャメルケースに変換
    setFacilitySettings({
      id: data.id,
      facilityId: data.facility_id,
      regularHolidays: data.regular_holidays,
      customHolidays: data.custom_holidays,
      businessHours: data.business_hours,
      capacity: data.capacity,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    });
  };

  // 他のデータ取得・更新メソッドも同様に実装...

  return {
    facilitySettings,
    updateFacilitySettings,
    loading,
    // 他のデータも返す...
  };
};
```

### 5. リアルタイム更新の設定（オプション）

Supabaseのリアルタイム機能を使用して、データの変更を自動的に反映：

```typescript
useEffect(() => {
  if (!facilityId) return;

  const channel = supabase
    .channel('facility_settings_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'facility_settings',
        filter: `facility_id=eq.${facilityId}`,
      },
      (payload) => {
        // データを更新
        if (payload.new) {
          setFacilitySettings({
            id: payload.new.id,
            facilityId: payload.new.facility_id,
            regularHolidays: payload.new.regular_holidays,
            customHolidays: payload.new.custom_holidays,
            businessHours: payload.new.business_hours,
            capacity: payload.new.capacity,
            createdAt: payload.new.created_at,
            updatedAt: payload.new.updated_at,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [facilityId]);
```

## 注意事項

1. **データベーススキーマ**: データベースではスネークケース（`facility_id`）を使用し、アプリケーションではキャメルケース（`facilityId`）を使用するため、変換が必要です。

2. **エラーハンドリング**: Supabaseのエラーを適切に処理する必要があります。

3. **認証**: SupabaseのRow Level Security (RLS)を設定して、各施設が自分のデータのみにアクセスできるようにする必要があります。

4. **移行**: 既存のローカルデータをSupabaseに移行するスクリプトを作成することをお勧めします。

## 参考

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)




