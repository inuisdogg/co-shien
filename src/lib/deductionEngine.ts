/**
 * 減算リスク検出エンジン
 * 障害児通所支援事業所の減算リスクをリアルタイムで検出
 */

import { supabase } from '@/lib/supabase';

export type DeductionRiskLevel = 'critical' | 'warning' | 'info';

export type DeductionRisk = {
  code: string;
  name: string;
  description: string;
  level: DeductionRiskLevel;
  impactRate: number; // 減算率 (例: 0.7 = 70%に減算)
  category: 'capacity' | 'personnel' | 'plan' | 'disclosure' | 'service_manager';
  details: string;
  recommendation: string;
};

export type DeductionCheckResult = {
  risks: DeductionRisk[];
  checkedAt: string;
  facilityId: string;
  date: string;
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    estimatedImpact: string; // e.g. "基本報酬の70%に減算"
  };
};

/**
 * 定員超過減算チェック
 * 利用児童数が定員を超えている場合、基本報酬が70%に減算
 */
async function checkCapacityOverflow(
  facilityId: string,
  date: string,
  capacity: number
): Promise<DeductionRisk | null> {
  const { data, error } = await supabase
    .from('schedules')
    .select('id', { count: 'exact' })
    .eq('facility_id', facilityId)
    .eq('date', date)
    .neq('slot', 'absent');

  if (error || !data) return null;

  const count = data.length;
  if (count > capacity) {
    return {
      code: 'CAPACITY_OVERFLOW',
      name: '定員超過減算',
      description: '利用児童数が定員を超過しています',
      level: 'critical',
      impactRate: 0.7,
      category: 'capacity',
      details: `定員${capacity}名に対し${count}名が利用（${count - capacity}名超過）`,
      recommendation: '利用調整を行い、定員内に収めてください',
    };
  }
  return null;
}

/**
 * 個別支援計画未作成減算チェック
 * 有効な個別支援計画がない児童がいる場合、該当児童分が減算
 */
async function checkSupportPlanMissing(
  facilityId: string
): Promise<DeductionRisk | null> {
  // 在籍児童を取得
  const { data: children } = await supabase
    .from('children')
    .select('id, name')
    .eq('facility_id', facilityId)
    .eq('status', 'active');

  if (!children || children.length === 0) return null;

  // 有効な支援計画を取得
  const { data: plans } = await supabase
    .from('support_plan_files')
    .select('child_id')
    .eq('facility_id', facilityId)
    .eq('status', 'active');

  const coveredChildIds = new Set((plans || []).map((p: any) => p.child_id));
  const uncoveredChildren = children.filter((c: any) => !coveredChildIds.has(c.id));

  if (uncoveredChildren.length > 0) {
    const severity = uncoveredChildren.length >= children.length * 0.5 ? 'critical' : 'warning';
    return {
      code: 'SUPPORT_PLAN_MISSING',
      name: '個別支援計画未作成減算',
      description: '有効な個別支援計画がない児童がいます',
      level: severity as DeductionRiskLevel,
      impactRate: severity === 'critical' ? 0.5 : 0.7,
      category: 'plan',
      details: `${children.length}名中${uncoveredChildren.length}名の計画が未作成（${uncoveredChildren.map((c: any) => c.name).join(', ')}）`,
      recommendation: '速やかに個別支援計画を作成してください',
    };
  }
  return null;
}

/**
 * 人員欠如減算チェック
 * 配置基準（2名以上、うち1名常勤専従）を満たしていない場合
 */
async function checkStaffingShortage(
  facilityId: string,
  date: string
): Promise<DeductionRisk | null> {
  const { data } = await supabase
    .from('daily_staffing_compliance')
    .select('*')
    .eq('facility_id', facilityId)
    .eq('date', date)
    .single();

  if (!data) return null;

  if (data.overall_status === 'non_compliant') {
    const warnings: string[] = [];
    if (!data.has_two_staff) warnings.push('2名配置未達');
    if (!data.has_fulltime_dedicated) warnings.push('常勤専従不在');
    if (data.fte_total < 2.0) warnings.push(`FTE不足（${data.fte_total}）`);

    return {
      code: 'STAFFING_SHORTAGE',
      name: '人員欠如減算',
      description: '人員配置基準を満たしていません',
      level: 'critical',
      impactRate: 0.7,
      category: 'personnel',
      details: warnings.join('、'),
      recommendation: '配置基準を満たすようシフトを調整してください',
    };
  }
  return null;
}

/**
 * サービス管理責任者欠如減算チェック
 * 児童発達支援管理責任者が配置されていない場合
 */
async function checkServiceManagerAbsent(
  facilityId: string
): Promise<DeductionRisk | null> {
  const { data } = await supabase
    .from('staff_personnel_settings')
    .select('id')
    .eq('facility_id', facilityId)
    .eq('is_service_manager', true)
    .is('effective_to', null)
    .limit(1);

  if (!data || data.length === 0) {
    return {
      code: 'SERVICE_MANAGER_ABSENT',
      name: 'サービス管理責任者欠如減算',
      description: '児童発達支援管理責任者が配置されていません',
      level: 'critical',
      impactRate: 0.7,
      category: 'service_manager',
      details: '児発管の配置が確認できません',
      recommendation: '児童発達支援管理責任者を配置し、人員設定に登録してください',
    };
  }
  return null;
}

/**
 * 自己評価結果未公表減算チェック
 * 自己評価を実施・公表していない場合
 */
async function checkSelfEvaluationNotPublished(
  facilityId: string
): Promise<DeductionRisk | null> {
  // 自己評価の公表状況をfacility_settingsから確認
  const { data } = await supabase
    .from('facility_settings')
    .select('self_evaluation_published, self_evaluation_published_at')
    .eq('facility_id', facilityId)
    .single();

  // データがない場合、またはフィールドがない場合は注意レベル
  if (!data || data.self_evaluation_published === false || data.self_evaluation_published === null) {
    return {
      code: 'SELF_EVALUATION_NOT_PUBLISHED',
      name: '自己評価結果未公表減算',
      description: '自己評価結果の公表が確認できません',
      level: 'warning',
      impactRate: 0.85,
      category: 'disclosure',
      details: '自己評価結果が未公表の場合、所定単位数の85/100に減算されます',
      recommendation: '自己評価を実施し、結果を公表してください',
    };
  }
  return null;
}

/**
 * 全減算リスクチェック実行
 */
export async function runDeductionCheck(
  facilityId: string,
  date: string,
  capacity: number
): Promise<DeductionCheckResult> {
  const risks: DeductionRisk[] = [];

  const checks = await Promise.all([
    checkCapacityOverflow(facilityId, date, capacity),
    checkSupportPlanMissing(facilityId),
    checkStaffingShortage(facilityId, date),
    checkServiceManagerAbsent(facilityId),
    checkSelfEvaluationNotPublished(facilityId),
  ]);

  checks.forEach(result => {
    if (result) risks.push(result);
  });

  // Sort by severity
  const levelOrder: Record<DeductionRiskLevel, number> = { critical: 0, warning: 1, info: 2 };
  risks.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  const criticalCount = risks.filter(r => r.level === 'critical').length;
  const warningCount = risks.filter(r => r.level === 'warning').length;
  const infoCount = risks.filter(r => r.level === 'info').length;

  const worstRate = risks.length > 0 ? Math.min(...risks.map(r => r.impactRate)) : 1;
  const estimatedImpact = worstRate < 1 ? `基本報酬の${Math.round(worstRate * 100)}%に減算リスク` : 'リスクなし';

  return {
    risks,
    checkedAt: new Date().toISOString(),
    facilityId,
    date,
    summary: {
      criticalCount,
      warningCount,
      infoCount,
      estimatedImpact,
    },
  };
}
