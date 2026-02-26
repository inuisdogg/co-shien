/**
 * 委員会開催追跡ユーティリティ
 * 虐待防止委員会・身体拘束適正化委員会（四半期最低1回）
 * BCP（年次最低1回）
 */

import { supabase } from '@/lib/supabase';

export type CommitteeType =
  | 'abuse_prevention'
  | 'restraint_review'
  | 'operation_promotion'
  | 'safety'
  | 'infection_control'
  | 'quality_improvement'
  | 'staff_meeting'
  | 'case_conference';

export type CommitteeRequirement = {
  type: CommitteeType;
  name: string;
  frequency: 'quarterly' | 'biannual' | 'annual';
  requiredPerPeriod: number;
};

export type CommitteeAlert = {
  committeeType: CommitteeType;
  committeeName: string;
  level: 'overdue' | 'upcoming' | 'ok';
  lastMeetingDate: string | null;
  nextDueDate: string;
  daysUntilDue: number;
  meetingsInPeriod: number;
  requiredInPeriod: number;
};

export type CommitteeCheckResult = {
  alerts: CommitteeAlert[];
  checkedAt: string;
  summary: {
    overdueCount: number;
    upcomingCount: number;
    okCount: number;
  };
};

const COMMITTEE_REQUIREMENTS: CommitteeRequirement[] = [
  { type: 'abuse_prevention', name: '虐待防止委員会', frequency: 'quarterly', requiredPerPeriod: 1 },
  { type: 'restraint_review', name: '身体拘束適正化委員会', frequency: 'quarterly', requiredPerPeriod: 1 },
  { type: 'operation_promotion', name: '運営推進会議', frequency: 'biannual', requiredPerPeriod: 1 },
];

/**
 * 四半期の開始・終了日を取得
 */
function getQuarterRange(date: Date): { start: string; end: string } {
  const quarter = Math.floor(date.getMonth() / 3);
  const startMonth = quarter * 3;
  const start = new Date(date.getFullYear(), startMonth, 1);
  const end = new Date(date.getFullYear(), startMonth + 3, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * 半期の開始・終了日を取得
 */
function getHalfYearRange(date: Date): { start: string; end: string } {
  const half = date.getMonth() < 6 ? 0 : 1;
  const startMonth = half * 6;
  const start = new Date(date.getFullYear(), startMonth, 1);
  const end = new Date(date.getFullYear(), startMonth + 6, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * 次の期限日を計算
 */
function getNextDueDate(frequency: CommitteeRequirement['frequency'], now: Date): string {
  if (frequency === 'quarterly') {
    const quarter = Math.floor(now.getMonth() / 3);
    const endMonth = (quarter + 1) * 3;
    return new Date(now.getFullYear(), endMonth, 0).toISOString().split('T')[0];
  }
  if (frequency === 'biannual') {
    const half = now.getMonth() < 6 ? 0 : 1;
    const endMonth = (half + 1) * 6;
    return new Date(now.getFullYear(), endMonth, 0).toISOString().split('T')[0];
  }
  // annual
  return new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
}

/**
 * 施設の委員会開催状況をチェック
 */
export async function checkCommitteeMeetings(
  facilityId: string
): Promise<CommitteeCheckResult> {
  const now = new Date();
  const alerts: CommitteeAlert[] = [];

  for (const req of COMMITTEE_REQUIREMENTS) {
    let range: { start: string; end: string };
    if (req.frequency === 'quarterly') {
      range = getQuarterRange(now);
    } else if (req.frequency === 'biannual') {
      range = getHalfYearRange(now);
    } else {
      range = { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
    }

    const { data: meetings } = await supabase
      .from('committee_meetings')
      .select('id, meeting_date')
      .eq('facility_id', facilityId)
      .eq('committee_type', req.type)
      .gte('meeting_date', range.start)
      .lte('meeting_date', range.end)
      .order('meeting_date', { ascending: false });

    const meetingsInPeriod = meetings?.length || 0;
    const lastMeetingDate = meetings?.[0]?.meeting_date || null;
    const nextDueDate = getNextDueDate(req.frequency, now);
    const daysUntilDue = Math.ceil((new Date(nextDueDate).getTime() - now.getTime()) / 86400000);

    let level: CommitteeAlert['level'] = 'ok';
    if (meetingsInPeriod < req.requiredPerPeriod) {
      level = daysUntilDue <= 14 ? 'overdue' : 'upcoming';
    }

    alerts.push({
      committeeType: req.type,
      committeeName: req.name,
      level,
      lastMeetingDate,
      nextDueDate,
      daysUntilDue,
      meetingsInPeriod,
      requiredInPeriod: req.requiredPerPeriod,
    });
  }

  const levelOrder = { overdue: 0, upcoming: 1, ok: 2 };
  alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  return {
    alerts,
    checkedAt: new Date().toISOString(),
    summary: {
      overdueCount: alerts.filter(a => a.level === 'overdue').length,
      upcomingCount: alerts.filter(a => a.level === 'upcoming').length,
      okCount: alerts.filter(a => a.level === 'ok').length,
    },
  };
}
