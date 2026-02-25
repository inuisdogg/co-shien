'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// キャリアタイムラインイベント
export type CareerTimelineEvent = {
  id: string;
  date: string;
  type: 'employment_start' | 'employment_end' | 'qualification' | 'training' | 'role_change' | 'certificate_issued';
  title: string;
  description: string;
  facilityName?: string;
};

// 年度別サマリー
export type AnnualCareerSummary = {
  year: number;
  attendanceDays: number;
  trainingHours: number;
  newQualifications: number;
  roleChanges: string[];
};

// 在籍日数計算結果
export type TenureInfo = {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  startDate: string;
  facilityName: string;
};

// フックの戻り値
export type UseCareerAccumulationReturn = {
  // 統計データ
  tenureList: TenureInfo[];
  totalAttendanceDays: number;
  totalTrainingHours: number;
  qualificationsCount: number;
  // タイムライン
  timelineEvents: CareerTimelineEvent[];
  // 年度別サマリー
  annualSummaries: AnnualCareerSummary[];
  // 状態
  isLoading: boolean;
  error: string | null;
  // リフレッシュ
  refresh: () => Promise<void>;
};

const calculateTenure = (startDate: string): { years: number; months: number; days: number; totalDays: number } => {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;
  return { years, months, days, totalDays: diffDays };
};

export function useCareerAccumulation(userId: string): UseCareerAccumulationReturn {
  const [tenureList, setTenureList] = useState<TenureInfo[]>([]);
  const [totalAttendanceDays, setTotalAttendanceDays] = useState(0);
  const [totalTrainingHours, setTotalTrainingHours] = useState(0);
  const [qualificationsCount, setQualificationsCount] = useState(0);
  const [timelineEvents, setTimelineEvents] = useState<CareerTimelineEvent[]>([]);
  const [annualSummaries, setAnnualSummaries] = useState<AnnualCareerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const events: CareerTimelineEvent[] = [];

      // 1. 所属記録を取得（在籍日数・タイムライン）
      const { data: employments, error: empError } = await supabase
        .from('employment_records')
        .select('*, facilities:facility_id(name)')
        .eq('user_id', userId)
        .order('start_date', { ascending: true });

      if (empError) {
        console.error('所属記録取得エラー:', empError);
      }

      const tenures: TenureInfo[] = [];
      if (employments) {
        employments.forEach((emp: any) => {
          const facilityName = emp.facilities?.name || '不明な施設';
          const tenure = calculateTenure(emp.start_date);
          tenures.push({
            ...tenure,
            startDate: emp.start_date,
            facilityName,
          });

          // タイムライン: 入社
          events.push({
            id: `emp-start-${emp.id}`,
            date: emp.start_date,
            type: 'employment_start',
            title: `${facilityName} 入社`,
            description: `${emp.role || 'スタッフ'}として勤務開始`,
            facilityName,
          });

          // タイムライン: 退社
          if (emp.end_date) {
            events.push({
              id: `emp-end-${emp.id}`,
              date: emp.end_date,
              type: 'employment_end',
              title: `${facilityName} 退社`,
              description: '勤務期間終了',
              facilityName,
            });
          }

          // タイムライン: 実務経験証明書発行
          if (emp.experience_verification_status === 'approved' && emp.experience_verification_approved_at) {
            events.push({
              id: `cert-${emp.id}`,
              date: emp.experience_verification_approved_at.split('T')[0],
              type: 'certificate_issued',
              title: `実務経験証明書発行（${facilityName}）`,
              description: '実務経験証明書が承認されました',
              facilityName,
            });
          }
        });
      }
      setTenureList(tenures);

      // 2. 勤怠記録から総出勤日数を取得
      const { data: attendanceData, error: attError } = await supabase
        .from('attendance_records')
        .select('date, type, facility_id')
        .eq('user_id', userId)
        .eq('type', 'start');

      if (attError) {
        console.error('勤怠記録取得エラー:', attError);
      }

      // ユニークな日付をカウント
      const uniqueDates = new Set<string>();
      const attendanceByYear: Record<number, Set<string>> = {};
      if (attendanceData) {
        attendanceData.forEach((record: any) => {
          const dateStr = record.date;
          if (dateStr) {
            uniqueDates.add(dateStr);
            const year = new Date(dateStr).getFullYear();
            if (!attendanceByYear[year]) attendanceByYear[year] = new Set();
            attendanceByYear[year].add(dateStr);
          }
        });
      }
      setTotalAttendanceDays(uniqueDates.size);

      // 3. 研修記録から総研修時間を取得
      const { data: trainingData, error: trainError } = await supabase
        .from('training_records')
        .select('*')
        .or(`participants.cs.{${userId}},user_id.eq.${userId}`);

      if (trainError) {
        console.error('研修記録取得エラー:', trainError);
      }

      let totalHours = 0;
      const trainingByYear: Record<number, number> = {};
      if (trainingData) {
        trainingData.forEach((training: any) => {
          const hours = training.duration_hours || 0;
          totalHours += hours;

          const trainDate = training.completed_date || training.training_date || training.created_at;
          if (trainDate) {
            const year = new Date(trainDate).getFullYear();
            trainingByYear[year] = (trainingByYear[year] || 0) + hours;

            // タイムライン: 研修完了
            events.push({
              id: `training-${training.id}`,
              date: trainDate.split('T')[0],
              type: 'training',
              title: `研修完了: ${training.title || training.name || '研修'}`,
              description: `${hours}時間の研修を修了`,
            });
          }
        });
      }
      setTotalTrainingHours(totalHours);

      // 4. 資格数を取得（usersテーブルのqualificationsまたはuser_careersテーブル）
      const { data: careerData, error: careerError } = await supabase
        .from('user_careers')
        .select('*')
        .eq('user_id', userId);

      let qualCount = 0;
      if (!careerError && careerData) {
        qualCount = careerData.length;

        // タイムライン: 資格取得
        careerData.forEach((career: any) => {
          if (career.issued_date) {
            events.push({
              id: `qual-${career.id}`,
              date: career.issued_date,
              type: 'qualification',
              title: `資格取得: ${career.qualification_name}`,
              description: career.issued_by ? `発行元: ${career.issued_by}` : '資格を取得しました',
            });
          }
        });
      }
      setQualificationsCount(qualCount);

      // 5. タイムラインをソート（新しい順）
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimelineEvents(events);

      // 6. 年度別サマリーを作成
      const allYears = new Set<number>();
      Object.keys(attendanceByYear).forEach(y => allYears.add(parseInt(y)));
      Object.keys(trainingByYear).forEach(y => allYears.add(parseInt(y)));
      if (employments) {
        employments.forEach((emp: any) => {
          const startYear = new Date(emp.start_date).getFullYear();
          const endYear = emp.end_date ? new Date(emp.end_date).getFullYear() : new Date().getFullYear();
          for (let y = startYear; y <= endYear; y++) {
            allYears.add(y);
          }
        });
      }

      const qualByYear: Record<number, number> = {};
      if (careerData) {
        careerData.forEach((career: any) => {
          if (career.issued_date) {
            const year = new Date(career.issued_date).getFullYear();
            qualByYear[year] = (qualByYear[year] || 0) + 1;
          }
        });
      }

      const roleChangesByYear: Record<number, string[]> = {};
      if (employments) {
        employments.forEach((emp: any) => {
          const year = new Date(emp.start_date).getFullYear();
          const facilityName = emp.facilities?.name || '施設';
          const role = emp.role || 'スタッフ';
          if (!roleChangesByYear[year]) roleChangesByYear[year] = [];
          roleChangesByYear[year].push(`${facilityName}: ${role}`);
        });
      }

      const summaries: AnnualCareerSummary[] = Array.from(allYears)
        .sort((a, b) => b - a)
        .map(year => ({
          year,
          attendanceDays: attendanceByYear[year]?.size || 0,
          trainingHours: trainingByYear[year] || 0,
          newQualifications: qualByYear[year] || 0,
          roleChanges: roleChangesByYear[year] || [],
        }));

      setAnnualSummaries(summaries);
    } catch (err) {
      console.error('キャリアデータ取得エラー:', err);
      setError('キャリアデータの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    tenureList,
    totalAttendanceDays,
    totalTrainingHours,
    qualificationsCount,
    timelineEvents,
    annualSummaries,
    isLoading,
    error,
    refresh: fetchData,
  };
}
