/**
 * 採用分析フック
 * 施設の採用活動に関する主要KPIとメトリクスを集計・提供する。
 * job_postings, job_applications, scout_messages, facilities テーブルからデータを取得。
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ------------------------------------------------------------------ types

export interface RecruitmentMetrics {
  totalJobPostings: number;
  activeJobPostings: number;
  totalApplications: number;
  applicationsByStatus: Record<string, number>;
  applicationsByMonth: { month: string; count: number }[];
  averageTimeToHire: number; // days
  topJobPostings: { id: string; title: string; applicationCount: number; hiredCount: number }[];
  conversionRate: number; // applications -> hired percentage
  scoutsSent: number;
  scoutResponseRate: number;
  averageRating: number;
  reviewCount: number;
}

export interface DateRange {
  start: string;
  end: string;
}

const EMPTY_METRICS: RecruitmentMetrics = {
  totalJobPostings: 0,
  activeJobPostings: 0,
  totalApplications: 0,
  applicationsByStatus: {},
  applicationsByMonth: [],
  averageTimeToHire: 0,
  topJobPostings: [],
  conversionRate: 0,
  scoutsSent: 0,
  scoutResponseRate: 0,
  averageRating: 0,
  reviewCount: 0,
};

// ------------------------------------------------------------------ hook

export function useRecruitmentAnalytics() {
  const [metrics, setMetrics] = useState<RecruitmentMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async (
    facilityId: string,
    dateRange?: DateRange,
  ) => {
    if (!facilityId) return;
    setLoading(true);
    setError(null);

    try {
      // ----------------------------------------------------------
      // 1. Job postings
      // ----------------------------------------------------------
      const { data: postingsData, error: postingsErr } = await supabase
        .from('job_postings')
        .select('id, title, status, created_at')
        .eq('facility_id', facilityId);
      if (postingsErr) throw postingsErr;

      const postings = postingsData || [];
      const totalJobPostings = postings.length;
      const activeJobPostings = postings.filter(
        (p: Record<string, unknown>) => p.status === 'published'
      ).length;

      // Get posting IDs for further queries
      const postingIds = postings.map((p: Record<string, unknown>) => p.id as string);

      // ----------------------------------------------------------
      // 2. Applications (joined with job_postings)
      // ----------------------------------------------------------
      let applications: Record<string, unknown>[] = [];

      if (postingIds.length > 0) {
        let query = supabase
          .from('job_applications')
          .select('id, status, created_at, updated_at, hired_at, job_posting_id')
          .in('job_posting_id', postingIds);

        if (dateRange) {
          query = query.gte('created_at', dateRange.start);
          query = query.lte('created_at', dateRange.end + 'T23:59:59.999Z');
        }

        const { data: appsData, error: appsErr } = await query;
        if (appsErr) throw appsErr;
        applications = appsData || [];
      }

      const totalApplications = applications.length;

      // Count by status
      const applicationsByStatus: Record<string, number> = {};
      for (const app of applications) {
        const status = app.status as string;
        applicationsByStatus[status] = (applicationsByStatus[status] || 0) + 1;
      }

      // Count by month
      const monthCounts: Record<string, number> = {};
      for (const app of applications) {
        const createdAt = app.created_at as string;
        if (createdAt) {
          const monthKey = createdAt.substring(0, 7); // YYYY-MM
          monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
        }
      }
      // Sort by month and convert to array
      const applicationsByMonth = Object.entries(monthCounts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count }));

      // Average time to hire (days from created_at to hired_at)
      const hiredApps = applications.filter(
        (a: Record<string, unknown>) => a.status === 'hired' && a.hired_at
      );
      let averageTimeToHire = 0;
      if (hiredApps.length > 0) {
        const totalDays = hiredApps.reduce((sum: number, app: Record<string, unknown>) => {
          const created = new Date(app.created_at as string).getTime();
          const hired = new Date(app.hired_at as string).getTime();
          const diffDays = (hired - created) / (1000 * 60 * 60 * 24);
          return sum + Math.max(0, diffDays);
        }, 0);
        averageTimeToHire = Math.round(totalDays / hiredApps.length);
      }

      // Conversion rate: hired / total applications
      const hiredCount = applicationsByStatus['hired'] || 0;
      const conversionRate = totalApplications > 0
        ? Math.round((hiredCount / totalApplications) * 1000) / 10
        : 0;

      // Top job postings by application count
      const postingAppCounts: Record<string, { count: number; hiredCount: number }> = {};
      for (const app of applications) {
        const jpId = app.job_posting_id as string;
        if (!postingAppCounts[jpId]) {
          postingAppCounts[jpId] = { count: 0, hiredCount: 0 };
        }
        postingAppCounts[jpId].count += 1;
        if (app.status === 'hired') {
          postingAppCounts[jpId].hiredCount += 1;
        }
      }

      const topJobPostings = Object.entries(postingAppCounts)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 5)
        .map(([id, { count, hiredCount: hc }]) => {
          const posting = postings.find((p: Record<string, unknown>) => p.id === id);
          return {
            id,
            title: posting ? (posting.title as string) : '不明',
            applicationCount: count,
            hiredCount: hc,
          };
        });

      // ----------------------------------------------------------
      // 3. Scout messages
      // ----------------------------------------------------------
      let scoutsSent = 0;
      let scoutResponseRate = 0;

      {
        let scoutQuery = supabase
          .from('scout_messages')
          .select('id, status, created_at')
          .eq('facility_id', facilityId);

        if (dateRange) {
          scoutQuery = scoutQuery.gte('created_at', dateRange.start);
          scoutQuery = scoutQuery.lte('created_at', dateRange.end + 'T23:59:59.999Z');
        }

        const { data: scoutsData, error: scoutsErr } = await scoutQuery;
        // If table doesn't exist yet, ignore the error
        if (!scoutsErr && scoutsData) {
          scoutsSent = scoutsData.length;
          const replied = scoutsData.filter(
            (s: Record<string, unknown>) => s.status === 'replied'
          ).length;
          scoutResponseRate = scoutsSent > 0
            ? Math.round((replied / scoutsSent) * 1000) / 10
            : 0;
        }
      }

      // ----------------------------------------------------------
      // 4. Facility rating info
      // ----------------------------------------------------------
      let averageRating = 0;
      let reviewCount = 0;

      {
        const { data: facilityData, error: facilityErr } = await supabase
          .from('facilities')
          .select('average_rating, review_count')
          .eq('id', facilityId)
          .single();

        if (!facilityErr && facilityData) {
          averageRating = facilityData.average_rating != null
            ? Math.round(Number(facilityData.average_rating) * 10) / 10
            : 0;
          reviewCount = Number(facilityData.review_count) || 0;
        }
      }

      // ----------------------------------------------------------
      // Compose final metrics
      // ----------------------------------------------------------
      setMetrics({
        totalJobPostings,
        activeJobPostings,
        totalApplications,
        applicationsByStatus,
        applicationsByMonth,
        averageTimeToHire,
        topJobPostings,
        conversionRate,
        scoutsSent,
        scoutResponseRate,
        averageRating,
        reviewCount,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '分析データの取得に失敗しました';
      setError(msg);
      console.error('fetchRecruitmentMetrics error:', msg);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    metrics,
    loading,
    error,
    fetchMetrics,
  };
}
