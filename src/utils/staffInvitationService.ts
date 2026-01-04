/**
 * スタッフ招待・アクティベーションサービス
 * 事業所がスタッフを招待し、スタッフがアカウントを有効化するワークフロー
 */

import { supabase } from '@/lib/supabase';
import { StaffInvitation, User, EmploymentRecord, AccountStatus } from '@/types';
import { hashPassword } from './password';

/**
 * 事業所がスタッフを招待（仮登録）
 * 名前とメールアドレス（または電話番号）だけでスタッフを登録
 * 既存の個人アカウントがある場合はそれを使用し、ない場合は新規作成
 * 
 * @param facilityId 事業所ID
 * @param invitation 招待情報
 * @param createEmploymentImmediately 即座に所属関係を作成するか（falseの場合はアカウント有効化時に作成）
 */
export async function inviteStaff(
  facilityId: string,
  invitation: StaffInvitation,
  createEmploymentImmediately: boolean = false
): Promise<{ userId: string; invitationToken: string; isExistingUser: boolean }> {
  try {
    // 既存のユーザーをチェック（メールまたは電話で）
    let existingUser: User | null = null;
    
    if (invitation.email) {
      const { data: emailUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', invitation.email)
        .single();
      
      if (emailUser) {
        existingUser = emailUser as any;
      }
    }
    
    if (!existingUser && invitation.phone) {
      const { data: phoneUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', invitation.phone)
        .single();
      
      if (phoneUser) {
        existingUser = phoneUser as any;
      }
    }

    let userId: string;
    let isExistingUser = false;

    if (existingUser) {
      // 既存の個人アカウントが見つかった場合
      userId = existingUser.id;
      isExistingUser = true;
      
      // 既にアクティブなユーザーで、即座に所属関係を作成する場合
      if (existingUser.accountStatus === 'active' && createEmploymentImmediately) {
        // 既存の所属関係をチェック（重複防止）
        const { data: existingEmployment } = await supabase
          .from('employment_records')
          .select('id')
          .eq('user_id', userId)
          .eq('facility_id', facilityId)
          .is('end_date', null)
          .single();
        
        if (!existingEmployment) {
          await createEmploymentRecord(userId, facilityId, invitation);
        }
        return { userId, invitationToken: '', isExistingUser: true };
      }
      
      // 既存ユーザーがpending状態の場合、招待情報を更新
      if (existingUser.accountStatus === 'pending') {
        await supabase
          .from('users')
          .update({
            invited_by_facility_id: facilityId,
            invited_at: new Date().toISOString(),
            // 招待時の雇用情報を更新
            invitation_start_date: invitation.startDate,
            invitation_role: invitation.role,
            invitation_employment_type: invitation.employmentType,
            invitation_permissions: invitation.permissions || {},
          })
          .eq('id', userId);
      }
    } else {
      // 新規ユーザーを作成（仮登録状態）
      // 個人アカウントとして独立して存在（事業所に所属していない状態）
      // UUIDを生成（ブラウザ環境とNode.js環境の両方に対応）
      const generateUUID = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          return crypto.randomUUID();
        }
        // フォールバック: 簡易的なUUID v4生成
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };

      // 後方互換性のため、usersテーブルのroleを設定
      // 新しい設計ではroleはemployment_recordsに移動しているが、
      // 既存のコードとの互換性のため'staff'を設定
      const userRole = 'staff'; // デフォルトは'staff'（後で削除予定のカラム）

      const newUser: any = {
        id: generateUUID(),
        name: invitation.name,
        email: invitation.email || null,
        phone: invitation.phone || null,
        account_status: 'pending' as AccountStatus,
        role: userRole, // 後方互換性のため設定（後で削除予定）
        // 後方互換性のため、facility_idも設定（後で削除予定）
        facility_id: facilityId,
        invited_by_facility_id: facilityId,
        invited_at: new Date().toISOString(),
        has_account: false,
        // 招待時の雇用情報を保存
        invitation_start_date: invitation.startDate,
        invitation_role: invitation.role,
        invitation_employment_type: invitation.employmentType,
        invitation_permissions: invitation.permissions || {},
      };

      const { data: createdUser, error: userError } = await supabase
        .from('users')
        .insert(newUser)
        .select()
        .single();

      if (userError || !createdUser) {
        throw new Error(`ユーザー作成エラー: ${userError?.message || 'Unknown error'}`);
      }

      userId = createdUser.id;
    }

    // 即座に所属関係を作成する場合のみ作成
    // そうでない場合は、アカウント有効化時に作成される
    if (createEmploymentImmediately) {
      await createEmploymentRecord(userId, facilityId, invitation);
    }

    // 招待トークンを生成（事業所IDとユーザーIDを含む）
    const invitationToken = generateInvitationToken(userId, facilityId);

    // 自動送信は行わない（リンクをコピーして事業所が手動で送付）

    return { userId, invitationToken, isExistingUser };
  } catch (error) {
    console.error('Error inviting staff:', error);
    throw error;
  }
}

/**
 * 所属関係を作成
 */
async function createEmploymentRecord(
  userId: string,
  facilityId: string,
  invitation: StaffInvitation
): Promise<void> {
  const employmentRecord = {
    user_id: userId,
    facility_id: facilityId,
    start_date: invitation.startDate,
    role: invitation.role,
    employment_type: invitation.employmentType,
    permissions: invitation.permissions || {},
    experience_verification_status: 'not_requested',
  };

  const { error } = await supabase
    .from('employment_records')
    .insert(employmentRecord);

  if (error) {
    throw new Error(`所属関係作成エラー: ${error.message}`);
  }
}

/**
 * スタッフがアカウントを有効化（パスワード設定）
 * 招待リンクから個人アカウントを作成・有効化し、必要に応じて所属関係を作成
 * 
 * @param invitationToken 招待トークン
 * @param password パスワード
 * @param loginId ログインID（オプション）
 * @param createEmployment 所属関係を作成するか（招待された事業所への所属）
 */
export async function activateAccount(
  invitationToken: string,
  password: string,
  loginId?: string,
  createEmployment: boolean = true
): Promise<{ user: User; employmentRecord?: EmploymentRecord }> {
  try {
    // トークンを検証（簡易版：実際にはより安全な検証を使用）
    const { userId, facilityId } = verifyInvitationToken(invitationToken);
    
    if (!userId) {
      throw new Error('無効な招待トークンです');
    }

    // ユーザーを取得
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      throw new Error('ユーザーが見つかりません');
    }

    // 既にアクティブなアカウントの場合、所属関係のみ作成する可能性がある
    const isAlreadyActive = user.account_status === 'active';
    
    if (!isAlreadyActive) {
      // パスワードをハッシュ化
      const passwordHash = await hashPassword(password);

      // ユーザーを更新
      const updateData: any = {
        password_hash: passwordHash,
        account_status: 'active',
        activated_at: new Date().toISOString(),
        has_account: true,
      };

      if (loginId) {
        updateData.login_id = loginId;
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (updateError || !updatedUser) {
        throw new Error(`アカウント有効化エラー: ${updateError?.message || 'Unknown error'}`);
      }

      user.account_status = 'active';
    }

    // 所属関係を作成する場合
    let employmentRecord: EmploymentRecord | undefined;
    if (createEmployment && facilityId) {
      // 既存の所属関係をチェック
      const { data: existingEmployment } = await supabase
        .from('employment_records')
        .select('*')
        .eq('user_id', userId)
        .eq('facility_id', facilityId)
        .is('end_date', null)
        .single();

      if (!existingEmployment) {
        // 招待情報から所属関係を作成
        // 招待情報を取得（usersテーブルのinvited_by_facility_idから）
        const { data: facility } = await supabase
          .from('facilities')
          .select('*')
          .eq('id', facilityId)
          .single();

      if (facility) {
        // ユーザー情報から招待時の雇用情報を取得
        const { data: userInfo } = await supabase
          .from('users')
          .select('invitation_start_date, invitation_role, invitation_employment_type, invitation_permissions')
          .eq('id', userId)
          .single();

        // 招待時の雇用情報があればそれを使用、なければデフォルト値
        const startDate = userInfo?.invitation_start_date || new Date().toISOString().split('T')[0];
        const role = userInfo?.invitation_role || '一般スタッフ';
        const employmentType = userInfo?.invitation_employment_type || '常勤';
        const permissions = userInfo?.invitation_permissions || {};

        const newEmployment = {
          user_id: userId,
          facility_id: facilityId,
          start_date: startDate,
          role: role,
          employment_type: employmentType,
          permissions: permissions,
          experience_verification_status: 'not_requested',
        };

          const { data: createdEmployment, error: empError } = await supabase
            .from('employment_records')
            .insert(newEmployment)
            .select(`
              *,
              facilities:facility_id (
                id,
                name,
                code
              )
            `)
            .single();

          if (!empError && createdEmployment) {
            employmentRecord = {
              ...createdEmployment,
              facilityName: (createdEmployment as any).facilities?.name,
              facilityCode: (createdEmployment as any).facilities?.code,
            } as EmploymentRecord;
          }
        }
      } else {
        employmentRecord = existingEmployment as any;
      }
    }

    return { user: user as any, employmentRecord };
  } catch (error) {
    console.error('Error activating account:', error);
    throw error;
  }
}

/**
 * 招待トークンを生成（簡易版）
 * 実際の実装では、JWTやより安全なトークン生成を使用してください
 */
function generateInvitationToken(userId: string, facilityId: string): string {
  // 簡易版：Base64エンコード
  // 実際の実装では、JWTや署名付きトークンを使用
  const tokenData = {
    userId,
    facilityId,
    timestamp: Date.now(),
  };
  // ブラウザ環境とNode.js環境の両方に対応
  if (typeof window !== 'undefined') {
    // ブラウザ環境
    return btoa(JSON.stringify(tokenData));
  } else {
    // Node.js環境
    return Buffer.from(JSON.stringify(tokenData)).toString('base64');
  }
}

/**
 * 招待トークンを検証
 */
function verifyInvitationToken(token: string): { userId: string; facilityId: string } {
  try {
    // ブラウザ環境とNode.js環境の両方に対応
    let decoded: string;
    if (typeof window !== 'undefined') {
      // ブラウザ環境
      decoded = atob(token);
    } else {
      // Node.js環境
      decoded = Buffer.from(token, 'base64').toString();
    }
    const tokenData = JSON.parse(decoded);
    // トークンの有効期限チェック（30日）
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30日
    if (Date.now() - tokenData.timestamp > maxAge) {
      throw new Error('招待トークンの有効期限が切れています');
    }
    return { userId: tokenData.userId, facilityId: tokenData.facilityId };
  } catch (error) {
    throw new Error('無効な招待トークンです');
  }
}

/**
 * 既存の個人アカウントを事業所に追加
 * 事業所で働くタイミングになったときに、既存の個人アカウントをスタッフリストに追加
 */
export async function addExistingUserToFacility(
  facilityId: string,
  userEmailOrPhone: string,
  invitation: Omit<StaffInvitation, 'name' | 'email' | 'phone'>
): Promise<EmploymentRecord> {
  try {
    // ユーザーを検索
    let user: User | null = null;
    
    const { data: emailUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', userEmailOrPhone)
      .single();
    
    if (emailUser) {
      user = emailUser as any;
    } else {
      const { data: phoneUser } = await supabase
        .from('users')
        .select('*')
        .eq('phone', userEmailOrPhone)
        .single();
      
      if (phoneUser) {
        user = phoneUser as any;
      }
    }

    if (!user) {
      throw new Error('ユーザーが見つかりません。まず招待リンクからアカウントを作成してください。');
    }

    if (user.accountStatus !== 'active') {
      throw new Error('このアカウントはまだ有効化されていません');
    }

    // 既存の所属関係をチェック
    const { data: existingEmployment } = await supabase
      .from('employment_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('facility_id', facilityId)
      .is('end_date', null)
      .single();

    if (existingEmployment) {
      throw new Error('このユーザーは既にこの事業所に所属しています');
    }

    // 所属関係を作成
    const employmentRecord = {
      user_id: user.id,
      facility_id: facilityId,
      start_date: invitation.startDate,
      role: invitation.role,
      employment_type: invitation.employmentType,
      permissions: invitation.permissions || {},
      experience_verification_status: 'not_requested',
    };

    const { data: createdEmployment, error: createError } = await supabase
      .from('employment_records')
      .insert(employmentRecord)
      .select(`
        *,
        facilities:facility_id (
          id,
          name,
          code
        )
      `)
      .single();

    if (createError || !createdEmployment) {
      throw new Error(`所属関係作成エラー: ${createError?.message || 'Unknown error'}`);
    }

    return {
      ...createdEmployment,
      facilityName: (createdEmployment as any).facilities?.name,
      facilityCode: (createdEmployment as any).facilities?.code,
    } as EmploymentRecord;
  } catch (error) {
    console.error('Error adding existing user to facility:', error);
    throw error;
  }
}

/**
 * 招待メールを送信（実装は後で追加）
 */
async function sendInvitationEmail(
  email: string,
  name: string,
  token: string,
  facilityId: string
): Promise<void> {
  // TODO: メール送信サービスを実装
  // 招待リンクを含むメールを送信
  // リンク例: https://yourdomain.com/activate?token=${token}
  console.log(`招待メールを送信: ${email}, トークン: ${token}, 事業所ID: ${facilityId}`);
  // 実際の実装では、SendGrid、AWS SES、Resendなどのサービスを使用
}

/**
 * 招待SMSを送信（実装は後で追加）
 */
async function sendInvitationSMS(
  phone: string,
  name: string,
  token: string,
  facilityId: string
): Promise<void> {
  // TODO: SMS送信サービスを実装
  // 招待リンクを含むSMSを送信
  console.log(`招待SMSを送信: ${phone}, トークン: ${token}, 事業所ID: ${facilityId}`);
  // 実際の実装では、Twilio、AWS SNSなどのサービスを使用
}

/**
 * 事業所が招待中のスタッフ一覧を取得
 */
export async function getPendingInvitations(facilityId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('invited_by_facility_id', facilityId)
    .eq('account_status', 'pending')
    .order('invited_at', { ascending: false });

  if (error) {
    throw new Error(`招待一覧取得エラー: ${error.message}`);
  }

  return (data || []) as any[];
}

/**
 * ユーザーの現在の所属事業所を取得
 */
export async function getUserActiveEmployments(userId: string): Promise<EmploymentRecord[]> {
  const { data, error } = await supabase
    .from('employment_records')
    .select(`
      *,
      facilities:facility_id (
        id,
        name,
        code
      )
    `)
    .eq('user_id', userId)
    .or('end_date.is.null,end_date.gte.' + new Date().toISOString().split('T')[0])
    .order('start_date', { ascending: false });

  if (error) {
    throw new Error(`所属情報取得エラー: ${error.message}`);
  }

  return (data || []).map((record: any) => ({
    ...record,
    facilityName: record.facilities?.name,
    facilityCode: record.facilities?.code,
  })) as EmploymentRecord[];
}

/**
 * 個人アカウントでログインしているユーザーを検索
 * 事業所が既存の個人アカウントをスタッフリストに追加する際に使用
 */
export async function searchUserByEmailOrPhone(
  emailOrPhone: string
): Promise<User | null> {
  const { data: emailUser } = await supabase
    .from('users')
    .select('*')
    .eq('email', emailOrPhone)
    .eq('account_status', 'active')
    .single();

  if (emailUser) {
    return emailUser as any;
  }

  const { data: phoneUser } = await supabase
    .from('users')
    .select('*')
    .eq('phone', emailOrPhone)
    .eq('account_status', 'active')
    .single();

  if (phoneUser) {
    return phoneUser as any;
  }

  return null;
}

