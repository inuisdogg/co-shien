/**
 * 変更届通知管理フック
 * 施設設定の変更を検出し、行政への届出期限を管理する
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type {
  ChangeNotification,
  ChangeNotificationType,
  ChangeNotificationStatus,
  FacilitySettings,
} from '@/types';

function mapRowToNotification(row: any): ChangeNotification {
  return {
    id: row.id,
    facilityId: row.facility_id,
    changeType: row.change_type,
    changeDescription: row.change_description,
    oldValue: row.old_value,
    newValue: row.new_value,
    detectedAt: row.detected_at,
    deadline: row.deadline,
    status: row.status,
    submittedAt: row.submitted_at,
    relatedDocuments: row.related_documents,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Calculate deadline for a change notification.
 * - Most changes: 10 days from detection
 * - Subsidy changes: 15th of the preceding month
 */
function calculateDeadline(changeType: ChangeNotificationType, detectedAt: Date): Date {
  if (changeType === 'subsidy') {
    // 15th of the preceding month relative to intended effective date
    // For simplicity, use 15th of current month (i.e., must be notified before the 15th for next month)
    const deadline = new Date(detectedAt);
    deadline.setDate(15);
    if (detectedAt.getDate() > 15) {
      // Already past the 15th, use next month's 15th
      deadline.setMonth(deadline.getMonth() + 1);
    }
    return deadline;
  }
  // Default: 10 days from detection
  const deadline = new Date(detectedAt);
  deadline.setDate(deadline.getDate() + 10);
  return deadline;
}

/**
 * Detect what types of changes occurred between old and new facility settings.
 */
export function detectSettingsChanges(
  oldSettings: FacilitySettings,
  newSettings: FacilitySettings
): { type: ChangeNotificationType; description: string; oldValue: any; newValue: any }[] {
  const changes: { type: ChangeNotificationType; description: string; oldValue: any; newValue: any }[] = [];

  // 1. Business hours change
  const oldBizHours = JSON.stringify(oldSettings.flexibleBusinessHours || oldSettings.businessHours);
  const newBizHours = JSON.stringify(newSettings.flexibleBusinessHours || newSettings.businessHours);
  const oldHolidays = JSON.stringify({
    regularHolidays: oldSettings.regularHolidays,
    customHolidays: oldSettings.customHolidays,
    includeHolidays: oldSettings.includeHolidays,
    holidayPeriods: oldSettings.holidayPeriods,
  });
  const newHolidays = JSON.stringify({
    regularHolidays: newSettings.regularHolidays,
    customHolidays: newSettings.customHolidays,
    includeHolidays: newSettings.includeHolidays,
    holidayPeriods: newSettings.holidayPeriods,
  });
  if (oldBizHours !== newBizHours || oldHolidays !== newHolidays) {
    changes.push({
      type: 'business_hours',
      description: '営業日/営業時間を変更しました。10日以内に変更届の提出が必要です。',
      oldValue: {
        businessHours: oldSettings.flexibleBusinessHours || oldSettings.businessHours,
        regularHolidays: oldSettings.regularHolidays,
        customHolidays: oldSettings.customHolidays,
        includeHolidays: oldSettings.includeHolidays,
      },
      newValue: {
        businessHours: newSettings.flexibleBusinessHours || newSettings.businessHours,
        regularHolidays: newSettings.regularHolidays,
        customHolidays: newSettings.customHolidays,
        includeHolidays: newSettings.includeHolidays,
      },
    });
  }

  // 2. Capacity change
  const oldCap = JSON.stringify(oldSettings.capacity);
  const newCap = JSON.stringify(newSettings.capacity);
  if (oldCap !== newCap) {
    changes.push({
      type: 'capacity',
      description: '定員を変更しました。10日以内に変更届の提出が必要です。',
      oldValue: { capacity: oldSettings.capacity },
      newValue: { capacity: newSettings.capacity },
    });
  }

  // 3. Facility name change
  if ((oldSettings.facilityName || '') !== (newSettings.facilityName || '')) {
    changes.push({
      type: 'facility_name',
      description: `事業所名称を「${oldSettings.facilityName || '(未設定)'}」から「${newSettings.facilityName || '(未設定)'}」に変更しました。10日以内に変更届の提出が必要です。`,
      oldValue: { facilityName: oldSettings.facilityName },
      newValue: { facilityName: newSettings.facilityName },
    });
  }

  // 4. Address change
  if ((oldSettings.address || '') !== (newSettings.address || '') ||
      (oldSettings.postalCode || '') !== (newSettings.postalCode || '')) {
    changes.push({
      type: 'address',
      description: '事業所所在地を変更しました。10日以内に変更届の提出が必要です。',
      oldValue: { address: oldSettings.address, postalCode: oldSettings.postalCode },
      newValue: { address: newSettings.address, postalCode: newSettings.postalCode },
    });
  }

  return changes;
}

/**
 * Days remaining until deadline.
 */
export function daysUntilDeadline(deadline: string): number {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get urgency color based on days remaining.
 */
export function getDeadlineColor(daysLeft: number): string {
  if (daysLeft < 0) return 'text-red-700';
  if (daysLeft <= 3) return 'text-red-600';
  if (daysLeft <= 5) return 'text-amber-600';
  return 'text-green-600';
}

export function getDeadlineBgColor(daysLeft: number): string {
  if (daysLeft < 0) return 'bg-red-100 border-red-300';
  if (daysLeft <= 3) return 'bg-red-50 border-red-200';
  if (daysLeft <= 5) return 'bg-amber-50 border-amber-200';
  return 'bg-green-50 border-green-200';
}

export const useChangeNotifications = () => {
  const { facility } = useAuth();
  const facilityId = facility?.id || '';

  const [notifications, setNotifications] = useState<ChangeNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all notifications for this facility
  const fetchNotifications = useCallback(async () => {
    if (!facilityId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('change_notifications')
        .select('*')
        .eq('facility_id', facilityId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching change notifications:', error);
        return;
      }

      if (data) {
        setNotifications(data.map(mapRowToNotification));
      }
    } catch (error) {
      console.error('Error in fetchNotifications:', error);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Count pending notifications
  const pendingCount = notifications.filter(
    (n) => n.status === 'pending' || n.status === 'in_progress'
  ).length;

  // Pending notifications sorted by deadline
  const pendingNotifications = notifications
    .filter((n) => n.status === 'pending' || n.status === 'in_progress')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  // Create a new change notification
  const createNotification = async (
    changeType: ChangeNotificationType,
    description: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>
  ): Promise<ChangeNotification | null> => {
    if (!facilityId) return null;

    const now = new Date();
    const deadline = calculateDeadline(changeType, now);

    const { data: userData } = await supabase.auth.getUser();

    try {
      const { data, error } = await supabase
        .from('change_notifications')
        .insert({
          facility_id: facilityId,
          change_type: changeType,
          change_description: description,
          old_value: oldValue || {},
          new_value: newValue || {},
          detected_at: now.toISOString(),
          deadline: deadline.toISOString(),
          status: 'pending',
          created_by: userData?.user?.id || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating change notification:', error);
        return null;
      }

      if (data) {
        const mapped = mapRowToNotification(data);
        setNotifications((prev) => [mapped, ...prev]);
        return mapped;
      }
      return null;
    } catch (error) {
      console.error('Error in createNotification:', error);
      return null;
    }
  };

  // Update notification status
  const updateStatus = async (
    notificationId: string,
    newStatus: ChangeNotificationStatus
  ) => {
    try {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'submitted') {
        updates.submitted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('change_notifications')
        .update(updates)
        .eq('id', notificationId);

      if (error) {
        console.error('Error updating notification status:', error);
        return;
      }

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId
            ? {
                ...n,
                status: newStatus,
                ...(newStatus === 'submitted' ? { submittedAt: new Date().toISOString() } : {}),
                updatedAt: new Date().toISOString(),
              }
            : n
        )
      );
    } catch (error) {
      console.error('Error in updateStatus:', error);
    }
  };

  // Create notifications from detected settings changes
  const createNotificationsFromChanges = async (
    changes: { type: ChangeNotificationType; description: string; oldValue: any; newValue: any }[]
  ) => {
    const results: ChangeNotification[] = [];
    for (const change of changes) {
      const result = await createNotification(
        change.type,
        change.description,
        change.oldValue,
        change.newValue
      );
      if (result) results.push(result);
    }
    return results;
  };

  return {
    notifications,
    pendingNotifications,
    pendingCount,
    loading,
    createNotification,
    createNotificationsFromChanges,
    updateStatus,
    refetch: fetchNotifications,
  };
};
