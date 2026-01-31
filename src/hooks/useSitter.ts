'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  SitterProfile,
  SitterBooking,
  SitterReport,
  SitterDashboardStats,
  SitterProfileFormData,
  BookingFormData,
  ReportFormData,
  mapSitterProfileFromDB,
  mapSitterBookingFromDB,
  mapSitterReportFromDB,
  SitterProfession,
} from '@/types/sitter';

// シッタープロフィール取得（スタッフ用）
export function useSitterProfile(userId?: string) {
  const [profile, setProfile] = useState<SitterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('sitter_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setProfile(mapSitterProfileFromDB(data));
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching sitter profile:', err);
      setError('プロフィールの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const createProfile = useCallback(async (formData: SitterProfileFormData): Promise<SitterProfile | null> => {
    if (!userId) return null;

    try {
      const insertData = {
        user_id: userId,
        display_name: formData.displayName,
        profile_image: formData.profileImage,
        introduction: formData.introduction,
        professions: formData.professions,
        specialty: formData.specialty,
        hourly_rate: formData.hourlyRate,
        minimum_hours: formData.minimumHours,
        service_areas: formData.serviceAreas,
        can_travel: formData.canTravel,
        travel_fee: formData.travelFee,
        is_tokyo_certified: formData.isTokyoCertified,
        is_public: formData.isPublic,
        is_accepting_bookings: formData.isAcceptingBookings,
      };

      const { data, error: insertError } = await supabase
        .from('sitter_profiles')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      const newProfile = mapSitterProfileFromDB(data);
      setProfile(newProfile);
      return newProfile;
    } catch (err) {
      console.error('Error creating sitter profile:', err);
      setError('プロフィールの作成に失敗しました');
      return null;
    }
  }, [userId]);

  const updateProfile = useCallback(async (formData: Partial<SitterProfileFormData>): Promise<boolean> => {
    if (!profile) return false;

    try {
      const updateData: Record<string, unknown> = {};

      if (formData.displayName !== undefined) updateData.display_name = formData.displayName;
      if (formData.profileImage !== undefined) updateData.profile_image = formData.profileImage;
      if (formData.introduction !== undefined) updateData.introduction = formData.introduction;
      if (formData.professions !== undefined) updateData.professions = formData.professions;
      if (formData.specialty !== undefined) updateData.specialty = formData.specialty;
      if (formData.hourlyRate !== undefined) updateData.hourly_rate = formData.hourlyRate;
      if (formData.minimumHours !== undefined) updateData.minimum_hours = formData.minimumHours;
      if (formData.serviceAreas !== undefined) updateData.service_areas = formData.serviceAreas;
      if (formData.canTravel !== undefined) updateData.can_travel = formData.canTravel;
      if (formData.travelFee !== undefined) updateData.travel_fee = formData.travelFee;
      if (formData.isTokyoCertified !== undefined) updateData.is_tokyo_certified = formData.isTokyoCertified;
      if (formData.isPublic !== undefined) updateData.is_public = formData.isPublic;
      if (formData.isAcceptingBookings !== undefined) updateData.is_accepting_bookings = formData.isAcceptingBookings;

      const { data, error: updateError } = await supabase
        .from('sitter_profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setProfile(mapSitterProfileFromDB(data));
      return true;
    } catch (err) {
      console.error('Error updating sitter profile:', err);
      setError('プロフィールの更新に失敗しました');
      return false;
    }
  }, [profile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isLoading,
    error,
    isSitter: !!profile,
    createProfile,
    updateProfile,
    refresh: fetchProfile,
  };
}

// 公開シッター一覧取得（クライアント用）
export function usePublicSitters(filters?: {
  professions?: SitterProfession[];
  areas?: string[];
  isTokyoCertified?: boolean;
  limit?: number;
}) {
  const [sitters, setSitters] = useState<SitterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSitters = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let query = supabase
        .from('sitter_profiles')
        .select('*')
        .eq('is_public', true)
        .eq('is_accepting_bookings', true)
        .order('rating_average', { ascending: false });

      if (filters?.professions && filters.professions.length > 0) {
        query = query.overlaps('professions', filters.professions);
      }

      if (filters?.areas && filters.areas.length > 0) {
        query = query.overlaps('service_areas', filters.areas);
      }

      if (filters?.isTokyoCertified) {
        query = query.eq('is_tokyo_certified', true);
      }

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setSitters((data || []).map(mapSitterProfileFromDB));
    } catch (err) {
      console.error('Error fetching sitters:', err);
      setError('シッター一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [filters?.professions, filters?.areas, filters?.isTokyoCertified, filters?.limit]);

  useEffect(() => {
    fetchSitters();
  }, [fetchSitters]);

  return { sitters, isLoading, error, refresh: fetchSitters };
}

// 単一シッター取得
export function usePublicSitter(sitterId: string) {
  const [sitter, setSitter] = useState<SitterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSitter = async () => {
      if (!sitterId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const { data, error: fetchError } = await supabase
          .from('sitter_profiles')
          .select('*')
          .eq('id', sitterId)
          .eq('is_public', true)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (data) {
          setSitter(mapSitterProfileFromDB(data));
        } else {
          setError('シッターが見つかりません');
        }
      } catch (err) {
        console.error('Error fetching sitter:', err);
        setError('シッター情報の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSitter();
  }, [sitterId]);

  return { sitter, isLoading, error };
}

// 予約管理（スタッフ用）
export function useSitterBookings(sitterId?: string) {
  const [bookings, setBookings] = useState<SitterBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!sitterId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const { data, error: fetchError } = await supabase
        .from('sitter_bookings')
        .select(`
          *,
          users!sitter_bookings_client_user_id_fkey(name),
          children(name, birth_date)
        `)
        .eq('sitter_id', sitterId)
        .order('booking_date', { ascending: true });

      if (fetchError) throw fetchError;

      setBookings((data || []).map(row => {
        const booking = mapSitterBookingFromDB(row);
        booking.clientName = (row.users as { name?: string })?.name;
        if (row.children) {
          const child = row.children as { name?: string; birth_date?: string };
          booking.childName = child.name;
          if (child.birth_date) {
            const birthDate = new Date(child.birth_date);
            const today = new Date();
            const ageInMonths = (today.getFullYear() - birthDate.getFullYear()) * 12 +
              (today.getMonth() - birthDate.getMonth());
            const years = Math.floor(ageInMonths / 12);
            const months = ageInMonths % 12;
            booking.childAge = `${years}歳${months}ヶ月`;
          }
        }
        return booking;
      }));
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setError('予約一覧の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [sitterId]);

  const updateBookingStatus = useCallback(async (bookingId: string, status: string): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('sitter_bookings')
        .update({ status })
        .eq('id', bookingId);

      if (updateError) throw updateError;

      await fetchBookings();
      return true;
    } catch (err) {
      console.error('Error updating booking:', err);
      return false;
    }
  }, [fetchBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, isLoading, error, updateBookingStatus, refresh: fetchBookings };
}

// 予約作成（クライアント用）
export function useClientBookings(clientUserId?: string) {
  const [bookings, setBookings] = useState<SitterBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!clientUserId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const { data, error: fetchError } = await supabase
        .from('sitter_bookings')
        .select(`
          *,
          sitter_profiles(display_name, profile_image)
        `)
        .eq('client_user_id', clientUserId)
        .order('booking_date', { ascending: false });

      if (fetchError) throw fetchError;

      setBookings((data || []).map(row => {
        const booking = mapSitterBookingFromDB(row);
        const sitter = row.sitter_profiles as { display_name?: string; profile_image?: string };
        booking.sitterName = sitter?.display_name;
        booking.sitterImage = sitter?.profile_image;
        return booking;
      }));
    } catch (err) {
      console.error('Error fetching client bookings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [clientUserId]);

  const createBooking = useCallback(async (formData: BookingFormData): Promise<SitterBooking | null> => {
    if (!clientUserId) return null;

    try {
      // シッター情報取得
      const { data: sitter } = await supabase
        .from('sitter_profiles')
        .select('hourly_rate, is_tokyo_certified, subsidy_eligible')
        .eq('id', formData.sitterId)
        .single();

      if (!sitter) return null;

      const startTime = new Date(`2000-01-01T${formData.startTime}`);
      const endTime = new Date(`2000-01-01T${formData.endTime}`);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

      const estimatedTotal = Math.round(hours * sitter.hourly_rate);
      const subsidyAmount = sitter.subsidy_eligible ? Math.round(hours * 2500) : 0;
      const clientPayment = estimatedTotal - subsidyAmount;

      const insertData = {
        sitter_id: formData.sitterId,
        client_user_id: clientUserId,
        child_id: formData.childId,
        booking_date: formData.bookingDate,
        start_time: formData.startTime,
        end_time: formData.endTime,
        location_address: formData.locationAddress,
        location_notes: formData.locationNotes,
        hourly_rate: sitter.hourly_rate,
        estimated_hours: hours,
        estimated_total: estimatedTotal,
        subsidy_eligible: sitter.subsidy_eligible,
        subsidy_amount: subsidyAmount,
        client_payment: clientPayment,
        client_memo: formData.clientMemo,
        status: 'pending',
      };

      const { data, error: insertError } = await supabase
        .from('sitter_bookings')
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      const newBooking = mapSitterBookingFromDB(data);
      await fetchBookings();
      return newBooking;
    } catch (err) {
      console.error('Error creating booking:', err);
      return null;
    }
  }, [clientUserId, fetchBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return { bookings, isLoading, createBooking, refresh: fetchBookings };
}

// 報告書管理
export function useSitterReports(sitterId?: string) {
  const [reports, setReports] = useState<SitterReport[]>([]);
  const [pendingReports, setPendingReports] = useState<{ bookingId: string; childName: string; date: string; hours: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!sitterId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // 既存の報告書取得
      const { data: reportsData } = await supabase
        .from('sitter_reports')
        .select('*')
        .eq('sitter_id', sitterId)
        .order('created_at', { ascending: false });

      setReports((reportsData || []).map(mapSitterReportFromDB));

      // 報告書未作成の予約取得
      const { data: bookingsData } = await supabase
        .from('sitter_bookings')
        .select(`
          id,
          booking_date,
          estimated_hours,
          children(name)
        `)
        .eq('sitter_id', sitterId)
        .eq('status', 'completed')
        .is('id', 'NOT IN (SELECT booking_id FROM sitter_reports)');

      // サブクエリが使えないので別の方法で
      const reportedBookingIds = (reportsData || []).map(r => r.booking_id);

      const { data: completedBookings } = await supabase
        .from('sitter_bookings')
        .select(`
          id,
          booking_date,
          estimated_hours,
          children(name)
        `)
        .eq('sitter_id', sitterId)
        .eq('status', 'completed');

      const unreportedBookings = (completedBookings || []).filter(
        b => !reportedBookingIds.includes(b.id)
      );

      setPendingReports(unreportedBookings.map(b => ({
        bookingId: b.id,
        childName: (b.children as { name?: string })?.name || '不明',
        date: b.booking_date,
        hours: `${b.estimated_hours}時間`,
      })));
    } catch (err) {
      console.error('Error fetching reports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sitterId]);

  const createReport = useCallback(async (bookingId: string, formData: ReportFormData): Promise<boolean> => {
    if (!sitterId) return false;

    try {
      const { error: insertError } = await supabase
        .from('sitter_reports')
        .insert({
          booking_id: bookingId,
          sitter_id: sitterId,
          child_condition: formData.childCondition,
          activities: formData.activities,
          developmental_notes: formData.developmentalNotes,
          meals_provided: formData.mealsProvided,
          special_notes: formData.specialNotes,
          language_activities: formData.languageActivities,
          motor_activities: formData.motorActivities,
          social_activities: formData.socialActivities,
          photos: formData.photos || [],
          status: 'draft',
        });

      if (insertError) throw insertError;

      await fetchReports();
      return true;
    } catch (err) {
      console.error('Error creating report:', err);
      return false;
    }
  }, [sitterId, fetchReports]);

  const submitReport = useCallback(async (reportId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('sitter_reports')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', reportId);

      if (error) throw error;

      await fetchReports();
      return true;
    } catch (err) {
      console.error('Error submitting report:', err);
      return false;
    }
  }, [fetchReports]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { reports, pendingReports, isLoading, createReport, submitReport, refresh: fetchReports };
}

// ダッシュボード統計
export function useSitterStats(sitterId?: string) {
  const [stats, setStats] = useState<SitterDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!sitterId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        // 今月の予約
        const { data: monthlyBookings } = await supabase
          .from('sitter_bookings')
          .select('actual_total, actual_hours, estimated_hours, status')
          .eq('sitter_id', sitterId)
          .gte('booking_date', firstOfMonth)
          .in('status', ['completed', 'confirmed', 'in_progress']);

        // 全体の予約
        const { data: allBookings } = await supabase
          .from('sitter_bookings')
          .select('actual_total, actual_hours, status')
          .eq('sitter_id', sitterId)
          .eq('status', 'completed');

        // 未作成報告書
        const { data: reports } = await supabase
          .from('sitter_reports')
          .select('booking_id')
          .eq('sitter_id', sitterId);

        const { count: pendingBookingsCount } = await supabase
          .from('sitter_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('sitter_id', sitterId)
          .eq('status', 'pending');

        const { count: confirmedBookingsCount } = await supabase
          .from('sitter_bookings')
          .select('*', { count: 'exact', head: true })
          .eq('sitter_id', sitterId)
          .eq('status', 'confirmed');

        // プロフィール情報
        const { data: profile } = await supabase
          .from('sitter_profiles')
          .select('rating_average, rating_count')
          .eq('id', sitterId)
          .single();

        const reportedBookingIds = new Set((reports || []).map(r => r.booking_id));
        const completedBookings = (allBookings || []).filter(b => b.status === 'completed');
        const pendingReportsCount = completedBookings.filter(b =>
          !reportedBookingIds.has((b as { id?: string }).id)
        ).length;

        setStats({
          totalEarnings: completedBookings.reduce((sum, b) => sum + (b.actual_total || 0), 0),
          monthlyEarnings: (monthlyBookings || [])
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + (b.actual_total || 0), 0),
          totalHours: completedBookings.reduce((sum, b) => sum + (b.actual_hours || 0), 0),
          monthlyHours: (monthlyBookings || [])
            .filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + (b.actual_hours || b.estimated_hours || 0), 0),
          pendingBookings: pendingBookingsCount || 0,
          confirmedBookings: confirmedBookingsCount || 0,
          pendingReports: pendingReportsCount,
          averageRating: profile?.rating_average || 0,
          totalReviews: profile?.rating_count || 0,
        });
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [sitterId]);

  return { stats, isLoading };
}
