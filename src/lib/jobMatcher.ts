/**
 * 求人マッチングエンジン
 * ユーザーの資格・経験と求人要件のスコアリングによるマッチング
 */

import { createServerSupabaseClient } from '@/lib/supabase';
import { QUALIFICATION_CODES, type QualificationCode } from '@/types';

export type MatchScore = {
  jobPostingId: string;
  score: number;
  matchReasons: string[];
};

/**
 * ユーザーと求人のマッチスコアを計算
 *
 * スコアリングルール:
 * - 必須資格マッチ: +30点/件
 * - 歓迎資格マッチ: +10点/件
 * - 経験年数が要件以上: +20点
 */
export function calculateMatchScore(
  userQualifications: string[],
  userExperienceYears: number,
  job: {
    requiredQualifications: string[];
    preferredQualifications: string[];
    experienceYearsMin: number;
  }
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 必須資格マッチ (+30点/件)
  for (const req of job.requiredQualifications) {
    if (userQualifications.includes(req)) {
      score += 30;
      const label =
        QUALIFICATION_CODES[req as QualificationCode] || req;
      reasons.push(`必須資格「${label}」を保有`);
    }
  }

  // 歓迎資格マッチ (+10点/件)
  for (const pref of job.preferredQualifications) {
    if (userQualifications.includes(pref)) {
      score += 10;
      const label =
        QUALIFICATION_CODES[pref as QualificationCode] || pref;
      reasons.push(`歓迎資格「${label}」を保有`);
    }
  }

  // 経験年数 (+20点)
  if (
    job.experienceYearsMin > 0 &&
    userExperienceYears >= job.experienceYearsMin
  ) {
    score += 20;
    reasons.push(
      `経験年数${userExperienceYears}年（必要: ${job.experienceYearsMin}年以上）`
    );
  }

  return { score, reasons };
}

/**
 * ユーザーに対するおすすめ求人をスコア順に取得
 */
export async function getTopMatchingJobs(
  userId: string,
  limit: number = 5
): Promise<MatchScore[]> {
  const supabase = createServerSupabaseClient();

  // ユーザーの資格情報を取得
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('qualifications')
    .eq('id', userId)
    .single();

  if (userError || !userData) return [];

  // staff テーブルから経験年数を取得
  const { data: staffData } = await supabase
    .from('staff')
    .select('years_of_experience')
    .eq('user_id', userId)
    .order('years_of_experience', { ascending: false })
    .limit(1);

  const userQualifications: string[] = Array.isArray(userData.qualifications)
    ? userData.qualifications
    : typeof userData.qualifications === 'string' && userData.qualifications
      ? userData.qualifications.split(',').map((q: string) => q.trim())
      : [];

  const userExperienceYears: number =
    staffData && staffData.length > 0
      ? Number(staffData[0].years_of_experience) || 0
      : 0;

  // 公開中の求人を取得
  const { data: jobs, error: jobsError } = await supabase
    .from('job_postings')
    .select('id, required_qualifications, preferred_qualifications, experience_years_min')
    .eq('status', 'published');

  if (jobsError || !jobs) return [];

  // スコア計算
  const scored: MatchScore[] = jobs
    .map((job) => {
      const { score, reasons } = calculateMatchScore(
        userQualifications,
        userExperienceYears,
        {
          requiredQualifications: (job.required_qualifications as string[]) || [],
          preferredQualifications: (job.preferred_qualifications as string[]) || [],
          experienceYearsMin: Number(job.experience_years_min) || 0,
        }
      );
      return {
        jobPostingId: job.id as string,
        score,
        matchReasons: reasons,
      };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
