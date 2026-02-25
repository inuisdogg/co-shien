# コーディング規約・パターン集

## 概要

本ドキュメントは、Rootsプロジェクトのコードベースから抽出したコーディング規約とパターンをまとめたものである。新規コード作成時や既存コード修正時はこれらのパターンに従うこと。

---

## 1. プロジェクト構成

### ディレクトリ構成ルール
```
src/
  app/          # Next.js App Router（ページ・レイアウト）
  components/   # UIコンポーネント（機能別サブディレクトリ）
  contexts/     # React Context（グローバル状態管理）
  hooks/        # カスタムフック（データ取得・ビジネスロジック）
  types/        # TypeScript型定義
  utils/        # ユーティリティ関数・サービス層
```

### ファイル命名規則
- コンポーネント: `PascalCase.tsx`（例: `DashboardView.tsx`, `ChildCard.tsx`）
- フック: `camelCase.ts`（例: `useFacilityData.ts`, `useStaffMaster.ts`）
- ユーティリティ: `camelCase.ts`（例: `additionCalculator.ts`, `dashboardCalculations.ts`）
- 型定義: `index.ts`（メイン型定義ファイル）
- サービス: `camelCaseService.ts`（例: `staffInvitationService.ts`）

---

## 2. Reactコンポーネントパターン

### 基本パターン
```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { SomeIcon } from 'lucide-react';

interface ComponentNameProps {
  facilityId: string;
  // ...その他のprops
}

export default function ComponentName({ facilityId }: ComponentNameProps) {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // データ取得処理
  }, [facilityId]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6">
      {/* コンテンツ */}
    </div>
  );
}
```

### View コンポーネント
- 各機能の最上位コンポーネントは `XxxView.tsx` と命名
- 例: `DashboardView.tsx`, `ScheduleView.tsx`, `ChildrenView.tsx`
- これらは `page.tsx` から呼び出される

### 未設定時のガイダンス表示パターン
```typescript
// 1. データ取得時にisConfiguredフラグを設定
const isConfigured = !!facilitySettings.serviceTypeCode &&
                     !!facilitySettings.regionalGrade;

// 2. UIで条件分岐
if (!isConfigured) {
  return <SetupGuidance missingItems={['サービス種別', '地域区分']} />;
}

// 3. 計算処理でも防御
const calculateRevenue = () => {
  if (!isConfigured) return { totalRevenue: 0, isValid: false };
  // 計算処理
};
```

---

## 3. カスタムフックパターン

### データ取得フック
```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase';

interface UseSomeDataResult {
  data: DataType[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSomeData(facilityId: string): UseSomeDataResult {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!facilityId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: queryError } = await supabase
        .from('table_name')
        .select('*')
        .eq('facility_id', facilityId);

      if (queryError) throw queryError;
      setData(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'データ取得エラー');
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### 命名規則
- `useFacilityData`: 施設データの取得・管理
- `useStaffMaster`: スタッフマスタデータの取得・管理
- `useShiftManagement`: シフト管理
- `useStaffingCompliance`: 人員配置コンプライアンス
- `useAdditionSimulation`: 加算シミュレーション

---

## 4. Supabaseクエリパターン

### 基本的なCRUD操作

```typescript
import { supabase } from '@/utils/supabase';

// 取得（SELECT）
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('facility_id', facilityId)
  .order('created_at', { ascending: false });

// 挿入（INSERT）
const { data, error } = await supabase
  .from('table_name')
  .insert({
    facility_id: facilityId,
    name: name,
    // ...
  })
  .select()
  .single();

// 更新（UPDATE）
const { data, error } = await supabase
  .from('table_name')
  .update({
    name: newName,
    updated_at: new Date().toISOString(),
  })
  .eq('id', id)
  .select()
  .single();

// 削除（DELETE）
const { error } = await supabase
  .from('table_name')
  .delete()
  .eq('id', id);

// UPSERT
const { data, error } = await supabase
  .from('table_name')
  .upsert({
    facility_id: facilityId,
    key: value,
  }, { onConflict: 'facility_id' })
  .select()
  .single();
```

### リレーション取得
```typescript
// JOIN相当
const { data, error } = await supabase
  .from('children')
  .select(`
    *,
    contracts (
      id,
      status,
      facility_id,
      contract_start_date,
      contract_end_date
    )
  `)
  .eq('contracts.facility_id', facilityId)
  .eq('contracts.status', 'active');
```

### マルチテナント対応
- 全てのクエリに `facility_id` のフィルタを必ず含める
- RLSポリシーもDBレベルで設定する（二重の防御）

---

## 5. TypeScript型定義パターン

### 基本的な型定義
```typescript
// types/index.ts に集約

// エンティティ型
export interface User {
  id: string;
  email: string;
  name: string;
  user_type: 'career' | 'client' | 'admin';
  account_status: 'pending' | 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Facility {
  id: string;
  name: string;
  code: string;
  company_id: string;
}

export interface FacilitySettings {
  id: string;
  facility_id: string;
  facility_name: string | null;
  service_type_code: string | null;
  regional_grade: string | null;
  business_hours: BusinessHours | null;
  capacity: CapacityConfig | null;
  regular_holidays: number[];
}

// JSONB型のネスト定義
export interface BusinessHours {
  start: string;
  end: string;
}

export interface CapacityConfig {
  [timeSlotId: string]: number;
}
```

### nullの扱い
- DBで未設定のカラムは `null` として扱う
- 型定義では `string | null` のようにユニオン型で表現
- コンポーネント内では `??` 演算子やオプショナルチェイニング `?.` を使用

### Enum相当の値
```typescript
// CHECK制約に対応する型
export type UserType = 'career' | 'client' | 'admin';
export type AccountStatus = 'pending' | 'active' | 'suspended';
export type ContractStatus = 'pending' | 'active' | 'terminated' | 'rejected';
export type EmploymentType = '常勤専従' | '常勤兼務' | '非常勤';
export type AdditionStatus = 'Planned' | 'Applying' | 'Active' | 'Inactive';
```

---

## 6. Tailwind CSSの規約

### カラーパレット
- プライマリ: `blue-600` / `blue-500`
- セカンダリ: `gray-*` 系
- サクセス: `green-600` / `green-500`
- ワーニング: `yellow-600` / `yellow-500`
- エラー: `red-600` / `red-500`

### レイアウトパターン
```tsx
// ページレイアウト
<div className="p-6">
  <h1 className="text-2xl font-bold text-gray-900 mb-6">ページタイトル</h1>
  {/* コンテンツ */}
</div>

// カード
<div className="bg-white rounded-lg shadow p-6">
  {/* カード内容 */}
</div>

// テーブル
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        ヘッダー
      </th>
    </tr>
  </thead>
  <tbody className="bg-white divide-y divide-gray-200">
    <tr>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        データ
      </td>
    </tr>
  </tbody>
</table>

// ボタン
<button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
  ボタンテキスト
</button>
```

### レスポンシブ対応
- モバイルファースト: `sm:`, `md:`, `lg:` の順でブレイクポイントを適用
- グリッド: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

---

## 7. エラーハンドリング

### 基本パターン
```typescript
try {
  const { data, error } = await supabase.from('table').select('*');
  if (error) throw error;
  // 正常処理
} catch (err) {
  console.error('エラーメッセージ:', err);
  setError(err instanceof Error ? err.message : '不明なエラーが発生しました');
}
```

### ユーザー向けエラー表示
```tsx
{error && (
  <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
    <p className="text-red-700 text-sm">{error}</p>
  </div>
)}
```

---

## 8. 認証コンテキスト

### AuthContextの使用パターン
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, facilityId, role } = useAuth();

  if (!user) {
    return <LoginRedirect />;
  }

  // facilityIdは全てのデータ取得で使用
  const { data } = useSomeData(facilityId);
}
```

---

## 9. 日本語の扱い

### コードコメント
- コメントは日本語で記述可能
- 変数名・関数名は英語（camelCase）

### UI表示テキスト
- 直接コンポーネント内に日本語文字列を記述（i18nは未導入）
- 将来的にi18n対応する場合に備え、長い文字列は定数化を推奨

### 日付フォーマット
```typescript
// 表示用: YYYY年MM月DD日
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// 和暦変換（行政書類用）
const toWareki = (date: string) => {
  return new Date(date).toLocaleDateString('ja-JP-u-ca-japanese', {
    era: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};
```

---

## 10. Git運用

### ブランチ戦略
- `main`: 本番環境
- `develop`: 開発環境
- `feature/xxx`: 機能開発
- `fix/xxx`: バグ修正

### コミットメッセージ
- 日本語または英語（プロジェクト内で統一）
- プレフィックス: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

---

*最終更新: 2026-02-25*
