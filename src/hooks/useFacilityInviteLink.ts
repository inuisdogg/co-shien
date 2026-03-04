/**
 * 施設招待リンク管理フック
 * facility_invite_links の CRUD操作
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { FacilityInviteLink } from '@/types/bulkImport';

interface UseFacilityInviteLinkReturn {
  inviteLinks: FacilityInviteLink[];
  loading: boolean;
  error: string | null;
  createInviteLink: (opts?: {
    label?: string;
    maxUses?: number;
    expiresAt?: string;
    defaultRole?: string;
    defaultEmploymentType?: string;
  }) => Promise<FacilityInviteLink | null>;
  toggleLinkActive: (id: string) => Promise<boolean>;
  deleteLink: (id: string) => Promise<boolean>;
  fetchLinks: () => Promise<void>;
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useFacilityInviteLink(): UseFacilityInviteLinkReturn {
  const { facility, user } = useAuth();
  const [inviteLinks, setInviteLinks] = useState<FacilityInviteLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!facility?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('facility_invite_links')
        .select('*')
        .eq('facility_id', facility.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setInviteLinks(
        (data || []).map((row: any) => ({
          id: row.id,
          facilityId: row.facility_id,
          code: row.code,
          label: row.label,
          isActive: row.is_active,
          maxUses: row.max_uses,
          useCount: row.use_count,
          defaultRole: row.default_role,
          defaultEmploymentType: row.default_employment_type,
          expiresAt: row.expires_at,
          createdBy: row.created_by,
          createdAt: row.created_at,
        }))
      );
    } catch (err: any) {
      console.error('Failed to fetch invite links:', err);
      setError('招待リンクの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [facility?.id]);

  const createInviteLink = useCallback(
    async (opts?: {
      label?: string;
      maxUses?: number;
      expiresAt?: string;
      defaultRole?: string;
      defaultEmploymentType?: string;
    }): Promise<FacilityInviteLink | null> => {
      if (!facility?.id) return null;

      setLoading(true);
      setError(null);

      try {
        const code = generateShortCode();
        const { data, error: insertError } = await supabase
          .from('facility_invite_links')
          .insert({
            facility_id: facility.id,
            code,
            label: opts?.label || null,
            max_uses: opts?.maxUses || null,
            expires_at: opts?.expiresAt || null,
            default_role: opts?.defaultRole || '一般スタッフ',
            default_employment_type: opts?.defaultEmploymentType || '常勤',
            created_by: user?.id || null,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        await fetchLinks();

        return {
          id: data.id,
          facilityId: data.facility_id,
          code: data.code,
          label: data.label,
          isActive: data.is_active,
          maxUses: data.max_uses,
          useCount: data.use_count,
          defaultRole: data.default_role,
          defaultEmploymentType: data.default_employment_type,
          expiresAt: data.expires_at,
          createdBy: data.created_by,
          createdAt: data.created_at,
        };
      } catch (err: any) {
        console.error('Failed to create invite link:', err);
        setError('招待リンクの作成に失敗しました');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [facility?.id, user?.id, fetchLinks]
  );

  const toggleLinkActive = useCallback(
    async (id: string): Promise<boolean> => {
      const link = inviteLinks.find(l => l.id === id);
      if (!link) return false;

      try {
        const { error: updateError } = await supabase
          .from('facility_invite_links')
          .update({ is_active: !link.isActive })
          .eq('id', id);

        if (updateError) throw updateError;

        await fetchLinks();
        return true;
      } catch (err: any) {
        console.error('Failed to toggle link:', err);
        setError('招待リンクの更新に失敗しました');
        return false;
      }
    },
    [inviteLinks, fetchLinks]
  );

  const deleteLink = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await supabase
          .from('facility_invite_links')
          .delete()
          .eq('id', id);

        if (deleteError) throw deleteError;

        await fetchLinks();
        return true;
      } catch (err: any) {
        console.error('Failed to delete link:', err);
        setError('招待リンクの削除に失敗しました');
        return false;
      }
    },
    [fetchLinks]
  );

  useEffect(() => {
    if (facility?.id) {
      fetchLinks();
    }
  }, [facility?.id, fetchLinks]);

  return {
    inviteLinks,
    loading,
    error,
    createInviteLink,
    toggleLinkActive,
    deleteLink,
    fetchLinks,
  };
}

export default useFacilityInviteLink;
