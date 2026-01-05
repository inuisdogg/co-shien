# 使用例：キャリアプラットフォーム

## シナリオ1: 新規スタッフの招待（個人アカウントを持っていない場合）

### 事業所側の操作

```typescript
import { inviteStaff } from '@/utils/staffInvitationService';

// 事業所がスタッフを招待
const invitation = {
  facilityId: 'facility-123',
  name: '山田 太郎',
  email: 'yamada@example.com',
  role: '一般スタッフ',
  employmentType: '常勤',
  startDate: '2024-04-01',
  permissions: {
    dashboard: true,
    schedule: true,
  }
};

// 招待（所属関係はアカウント有効化時に作成）
const { userId, invitationToken, isExistingUser } = await inviteStaff(
  'facility-123',
  invitation,
  false // 即座に所属関係を作成しない
);

// 招待リンクをスタッフに送信
// https://yourdomain.com/activate?token=${invitationToken}
```

### スタッフ側の操作

```typescript
import { activateAccount } from '@/utils/staffInvitationService';

// スタッフが招待リンクからアカウントを有効化
const { user, employmentRecord } = await activateAccount(
  invitationToken,
  'password123',
  'yamada-taro', // ログインID（オプション）
  true // 所属関係を作成
);

// これで個人アカウントが作成され、事業所に所属
```

## シナリオ2: 既存の個人アカウントを事業所に追加

### 事業所側の操作

```typescript
import { addExistingUserToFacility, searchUserByEmailOrPhone } from '@/utils/staffInvitationService';

// 既存の個人アカウントを検索
const existingUser = await searchUserByEmailOrPhone('yamada@example.com');

if (existingUser) {
  // 既存の個人アカウントを事業所に追加
  const employmentRecord = await addExistingUserToFacility(
    'facility-123',
    'yamada@example.com',
    {
      role: '一般スタッフ',
      employmentType: '常勤',
      startDate: '2024-04-01',
      permissions: {
        dashboard: true,
        schedule: true,
      }
    }
  );
  
  console.log('既存の個人アカウントを事業所に追加しました');
} else {
  // 個人アカウントが見つからない場合は招待
  await inviteStaff('facility-123', invitation, false);
}
```

## シナリオ3: 個人アカウントが独立して存在

### スタッフ側の操作

```typescript
import { getUserActiveEmployments } from '@/utils/staffInvitationService';

// ユーザーが現在所属している事業所を確認
const activeEmployments = await getUserActiveEmployments(userId);

console.log('現在所属している事業所:', activeEmployments);
// 結果: [] （事業所に所属していない状態）

// 個人アカウントは独立して存在し、以下の情報を保持：
// - 基本情報（名前、メール、電話）
// - 資格情報
// - 認証済み職歴
```

## シナリオ4: 実務経験証明の申請

### スタッフ側の操作

```typescript
import { requestExperienceVerification } from '@/utils/experienceVerificationService';

// 過去の所属記録に対して実務経験証明を申請
const verificationRequest = await requestExperienceVerification(
  userId,
  employmentRecordId, // 過去の所属記録ID
  '2022年4月から2024年3月まで在籍していました。実務経験証明をお願いします。'
);

console.log('実務経験証明を申請しました');
```

### 事業所側の操作（元職場の管理者）

```typescript
import { getFacilityVerificationRequests, approveExperienceVerification } from '@/utils/experienceVerificationService';

// 事業所が受け取った実務経験証明依頼を確認
const requests = await getFacilityVerificationRequests('facility-123');

// 依頼を承認
const approvedRequest = await approveExperienceVerification(
  requestId,
  approverUserId,
  '承認しました。在籍期間と役割を確認しました。'
);

console.log('実務経験証明を承認しました');
```

## シナリオ5: 複数の事業所に所属

```typescript
// ユーザーが複数の事業所に所属している場合
const activeEmployments = await getUserActiveEmployments(userId);

// 結果例:
// [
//   { facilityId: 'facility-123', facilityName: 'A事業所', role: '一般スタッフ' },
//   { facilityId: 'facility-456', facilityName: 'B事業所', role: 'マネージャー' }
// ]

// 各事業所での権限や役割は独立して管理される
```

## 重要なポイント

1. **個人アカウントは独立**: 事業所に所属していなくても、個人アカウントとして存在可能
2. **柔軟な所属管理**: 既存の個人アカウントを事業所に追加可能
3. **招待方式**: 個人アカウントを持っていない場合は、招待リンクから作成可能
4. **複数所属対応**: 1人のユーザーが複数の事業所に所属可能
5. **キャリアの持ち運び**: 認証済み職歴や資格は個人アカウントに蓄積され、持ち運び可能



