/**
 * 実務経験証明サービス
 * スタッフが元職場に実務経験証明を依頼し、承認を受けるワークフロー
 */

import { supabase } from '@/lib/supabase';
import {
  ExperienceVerificationRequest,
  EmploymentRecord,
  VerificationRequestStatus,
} from '@/types';

/**
 * スタッフが実務経験証明を申請
 */
export async function requestExperienceVerification(
  userId: string,
  employmentRecordId: string,
  requestMessage?: string
): Promise<ExperienceVerificationRequest> {
  try {
    // 所属記録を取得
    const { data: employmentRecord, error: recordError } = await supabase
      .from('employment_records')
      .select(`
        *,
        facilities:facility_id (
          id,
          name
        )
      `)
      .eq('id', employmentRecordId)
      .eq('user_id', userId)
      .single();

    if (recordError || !employmentRecord) {
      throw new Error('所属記録が見つかりません');
    }

    // 既に申請中または承認済みの場合はエラー
    if (
      employmentRecord.experience_verification_status === 'requested' ||
      employmentRecord.experience_verification_status === 'approved'
    ) {
      throw new Error('この所属記録は既に申請中または承認済みです');
    }

    // 実務経験証明依頼を作成
    const verificationRequest = {
      requester_user_id: userId,
      employment_record_id: employmentRecordId,
      approver_facility_id: employmentRecord.facility_id,
      requested_period_start: employmentRecord.start_date,
      requested_period_end: employmentRecord.end_date || null,
      requested_role: employmentRecord.role,
      status: 'pending' as VerificationRequestStatus,
      request_message: requestMessage || null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日後
    };

    const { data: createdRequest, error: createError } = await supabase
      .from('experience_verification_requests')
      .insert(verificationRequest)
      .select(`
        *,
        requester:requester_user_id (
          id,
          name
        ),
        facilities:approver_facility_id (
          id,
          name
        )
      `)
      .single();

    if (createError || !createdRequest) {
      throw new Error(`申請エラー: ${createError?.message || 'Unknown error'}`);
    }

    // 所属記録のステータスを更新
    await supabase
      .from('employment_records')
      .update({
        experience_verification_status: 'requested',
        experience_verification_requested_at: new Date().toISOString(),
      })
      .eq('id', employmentRecordId);

    // 事業所の管理者に通知を送信
    await notifyFacilityAdmins(
      employmentRecord.facility_id,
      createdRequest.id,
      employmentRecord.facilities?.name || ''
    );

    return {
      ...createdRequest,
      requesterName: (createdRequest as any).requester?.name,
      facilityName: (createdRequest as any).facilities?.name,
    } as ExperienceVerificationRequest;
  } catch (error) {
    console.error('Error requesting experience verification:', error);
    throw error;
  }
}

/**
 * 事業所の管理者が実務経験証明を承認
 */
export async function approveExperienceVerification(
  requestId: string,
  approverUserId: string,
  responseMessage?: string
): Promise<ExperienceVerificationRequest> {
  try {
    // 依頼を取得
    const { data: request, error: requestError } = await supabase
      .from('experience_verification_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      throw new Error('依頼が見つかりません');
    }

    // 承認者のデジタル署名を生成（簡易版）
    const digitalSignature = generateDigitalSignature(approverUserId, requestId);

    // 依頼を承認済みに更新
    const { data: updatedRequest, error: updateError } = await supabase
      .from('experience_verification_requests')
      .update({
        status: 'approved',
        approver_user_id: approverUserId,
        digital_signature: digitalSignature,
        response_message: responseMessage || null,
        signed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select(`
        *,
        requester:requester_user_id (
          id,
          name
        ),
        facilities:approver_facility_id (
          id,
          name
        )
      `)
      .single();

    if (updateError || !updatedRequest) {
      throw new Error(`承認エラー: ${updateError?.message || 'Unknown error'}`);
    }

    // 所属記録のステータスを更新
    await supabase
      .from('employment_records')
      .update({
        experience_verification_status: 'approved',
        experience_verification_approved_at: new Date().toISOString(),
        experience_verification_approved_by: approverUserId,
      })
      .eq('id', request.employment_record_id);

    // 申請者に通知を送信
    await notifyRequester(request.requester_user_id, updatedRequest.id);

    return {
      ...updatedRequest,
      requesterName: (updatedRequest as any).requester?.name,
      facilityName: (updatedRequest as any).facilities?.name,
      approverName: approverUserId, // TODO: 実際のユーザー名を取得
    } as ExperienceVerificationRequest;
  } catch (error) {
    console.error('Error approving experience verification:', error);
    throw error;
  }
}

/**
 * 事業所の管理者が実務経験証明を却下
 */
export async function rejectExperienceVerification(
  requestId: string,
  approverUserId: string,
  rejectionReason: string
): Promise<ExperienceVerificationRequest> {
  try {
    // 依頼を取得
    const { data: request, error: requestError } = await supabase
      .from('experience_verification_requests')
      .select('*')
      .eq('id', requestId)
      .eq('status', 'pending')
      .single();

    if (requestError || !request) {
      throw new Error('依頼が見つかりません');
    }

    // 依頼を却下に更新
    const { data: updatedRequest, error: updateError } = await supabase
      .from('experience_verification_requests')
      .update({
        status: 'rejected',
        approver_user_id: approverUserId,
        rejection_reason: rejectionReason,
      })
      .eq('id', requestId)
      .select(`
        *,
        requester:requester_user_id (
          id,
          name
        ),
        facilities:approver_facility_id (
          id,
          name
        )
      `)
      .single();

    if (updateError || !updatedRequest) {
      throw new Error(`却下エラー: ${updateError?.message || 'Unknown error'}`);
    }

    // 所属記録のステータスを更新
    await supabase
      .from('employment_records')
      .update({
        experience_verification_status: 'rejected',
      })
      .eq('id', request.employment_record_id);

    // 申請者に通知を送信
    await notifyRequester(request.requester_user_id, updatedRequest.id);

    return {
      ...updatedRequest,
      requesterName: (updatedRequest as any).requester?.name,
      facilityName: (updatedRequest as any).facilities?.name,
    } as ExperienceVerificationRequest;
  } catch (error) {
    console.error('Error rejecting experience verification:', error);
    throw error;
  }
}

/**
 * ユーザーの実務経験証明依頼一覧を取得
 */
export async function getUserVerificationRequests(
  userId: string
): Promise<ExperienceVerificationRequest[]> {
  const { data, error } = await supabase
    .from('experience_verification_requests')
    .select(`
      *,
      requester:requester_user_id (
        id,
        name
      ),
      facilities:approver_facility_id (
        id,
        name
      )
    `)
    .eq('requester_user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`依頼一覧取得エラー: ${error.message}`);
  }

  return (data || []).map((req: any) => ({
    ...req,
    requesterName: req.requester?.name,
    facilityName: req.facilities?.name,
  })) as ExperienceVerificationRequest[];
}

/**
 * 事業所が受け取った実務経験証明依頼一覧を取得
 */
export async function getFacilityVerificationRequests(
  facilityId: string
): Promise<ExperienceVerificationRequest[]> {
  const { data, error } = await supabase
    .from('experience_verification_requests')
    .select(`
      *,
      requester:requester_user_id (
        id,
        name,
        email
      ),
      facilities:approver_facility_id (
        id,
        name
      )
    `)
    .eq('approver_facility_id', facilityId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`依頼一覧取得エラー: ${error.message}`);
  }

  return (data || []).map((req: any) => ({
    ...req,
    requesterName: req.requester?.name,
    facilityName: req.facilities?.name,
  })) as ExperienceVerificationRequest[];
}

/**
 * 承認済みの実務経験を取得
 */
export async function getVerifiedExperiences(
  userId: string
): Promise<EmploymentRecord[]> {
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
    .eq('experience_verification_status', 'approved')
    .order('start_date', { ascending: false });

  if (error) {
    throw new Error(`承認済み経験取得エラー: ${error.message}`);
  }

  return (data || []).map((record: any) => ({
    ...record,
    facilityName: record.facilities?.name,
    facilityCode: record.facilities?.code,
  })) as EmploymentRecord[];
}

/**
 * デジタル署名を生成（簡易版）
 * 実際の実装では、より安全な署名方式を使用してください
 */
function generateDigitalSignature(userId: string, requestId: string): string {
  // 簡易版：実際の実装では、RSA署名やJWT署名を使用
  const signatureData = {
    userId,
    requestId,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(signatureData)).toString('base64');
}

/**
 * 事業所の管理者に通知を送信
 */
async function notifyFacilityAdmins(
  facilityId: string,
  requestId: string,
  facilityName: string
): Promise<void> {
  // TODO: 通知サービスを実装
  // 事業所の管理者（admin、manager）に通知を送信
  console.log(`事業所 ${facilityName} の管理者に通知: 実務経験証明依頼 ${requestId}`);
}

/**
 * 申請者に通知を送信
 */
async function notifyRequester(userId: string, requestId: string): Promise<void> {
  // TODO: 通知サービスを実装
  console.log(`ユーザー ${userId} に通知: 実務経験証明依頼 ${requestId} のステータス更新`);
}

