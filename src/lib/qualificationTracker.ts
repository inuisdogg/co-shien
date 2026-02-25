/**
 * 資格期限追跡ユーティリティ
 * 児発管資格更新、実務経験要件、期限切れリマインダー
 */

import { supabase } from '@/lib/supabase';

export type QualificationAlert = {
  staffId: string;
  staffName: string;
  qualificationName: string;
  expiryDate: string;
  daysUntilExpiry: number;
  level: 'expired' | 'urgent' | 'warning' | 'info';
};

export type QualificationCheckResult = {
  alerts: QualificationAlert[];
  checkedAt: string;
  summary: {
    expired: number;
    urgentCount: number; // 30日以内
    warningCount: number; // 90日以内
  };
};

/**
 * アラートレベルを判定
 */
function getAlertLevel(daysUntilExpiry: number): QualificationAlert['level'] {
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'urgent';
  if (daysUntilExpiry <= 90) return 'warning';
  return 'info';
}

/**
 * 施設のスタッフ資格期限をチェック
 */
export async function checkQualificationExpiry(
  facilityId: string
): Promise<QualificationCheckResult> {
  const alerts: QualificationAlert[] = [];

  // スタッフの資格情報を取得
  const { data: staffData } = await supabase
    .from('staff')
    .select('id, name, user_id')
    .eq('facility_id', facilityId);

  if (!staffData || staffData.length === 0) {
    return { alerts: [], checkedAt: new Date().toISOString(), summary: { expired: 0, urgentCount: 0, warningCount: 0 } };
  }

  // user_idがあるスタッフのキャリア（資格）情報を取得
  const userIds = staffData.filter((s: any) => s.user_id).map((s: any) => s.user_id);

  if (userIds.length > 0) {
    const { data: careers } = await supabase
      .from('user_career')
      .select('*')
      .in('user_id', userIds)
      .not('expiry_date', 'is', null);

    if (careers) {
      const now = new Date();
      careers.forEach((career: any) => {
        const staff = staffData.find((s: any) => s.user_id === career.user_id);
        if (!staff || !career.expiry_date) return;

        const expiryDate = new Date(career.expiry_date);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);

        // 180日以内の期限のみアラート対象
        if (daysUntilExpiry <= 180) {
          alerts.push({
            staffId: staff.id,
            staffName: staff.name,
            qualificationName: career.qualification_name,
            expiryDate: career.expiry_date,
            daysUntilExpiry,
            level: getAlertLevel(daysUntilExpiry),
          });
        }
      });
    }
  }

  // Sort by urgency
  const levelOrder = { expired: 0, urgent: 1, warning: 2, info: 3 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return {
    alerts,
    checkedAt: new Date().toISOString(),
    summary: {
      expired: alerts.filter(a => a.level === 'expired').length,
      urgentCount: alerts.filter(a => a.level === 'urgent').length,
      warningCount: alerts.filter(a => a.level === 'warning').length,
    },
  };
}
