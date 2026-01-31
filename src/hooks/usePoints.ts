'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  UserPoints,
  PointTransaction,
  PointTransactionType,
  POINT_PACKAGES,
  PointPackage,
} from '@/types/expert';

export type UsePointsReturn = {
  points: UserPoints | null;
  transactions: PointTransaction[];
  isLoading: boolean;
  error: string | null;

  // ポイント操作
  purchasePoints: (packageId: string) => Promise<boolean>;
  consumePoints: (amount: number, consultationId?: string, description?: string) => Promise<boolean>;

  // 残高確認
  hasEnoughPoints: (amount: number) => boolean;

  // リフレッシュ
  refresh: () => Promise<void>;
  loadTransactions: (limit?: number) => Promise<void>;
};

export function usePoints(userId?: string): UsePointsReturn {
  const [points, setPoints] = useState<UserPoints | null>(null);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ポイント残高取得
  const fetchPoints = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (data) {
        setPoints({
          id: data.id,
          userId: data.user_id,
          balance: data.balance,
          totalPurchased: data.total_purchased,
          totalUsed: data.total_used,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } else {
        // ポイント未作成の場合は0で初期化
        setPoints({
          id: '',
          userId: userId,
          balance: 0,
          totalPurchased: 0,
          totalUsed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error fetching points:', err);
      setError('ポイント情報の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 取引履歴取得
  const loadTransactions = useCallback(async (limit = 20) => {
    if (!userId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw fetchError;
      }

      setTransactions((data || []).map(row => ({
        id: row.id,
        userId: row.user_id,
        transactionType: row.transaction_type as PointTransactionType,
        amount: row.amount,
        balanceAfter: row.balance_after,
        relatedConsultationId: row.related_consultation_id,
        relatedOrderId: row.related_order_id,
        description: row.description,
        createdAt: row.created_at,
      })));
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  }, [userId]);

  // ポイント購入（モック）
  const purchasePoints = useCallback(async (packageId: string): Promise<boolean> => {
    if (!userId) {
      setError('ログインが必要です');
      return false;
    }

    const pkg = POINT_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      setError('無効なパッケージです');
      return false;
    }

    try {
      setError(null);

      const totalPoints = pkg.points + pkg.bonusPoints;

      // RPCを呼び出してポイント追加
      const { data: newBalance, error: rpcError } = await supabase.rpc('add_points', {
        p_user_id: userId,
        p_amount: totalPoints,
        p_description: `${pkg.label} 購入${pkg.bonusPoints > 0 ? ` (+${pkg.bonusPoints}ボーナス)` : ''}`,
        p_order_id: `mock_${Date.now()}`,
      });

      if (rpcError) {
        throw rpcError;
      }

      // 状態を更新
      await fetchPoints();
      await loadTransactions();

      return true;
    } catch (err) {
      console.error('Error purchasing points:', err);
      setError('ポイント購入に失敗しました');
      return false;
    }
  }, [userId, fetchPoints, loadTransactions]);

  // ポイント消費
  const consumePoints = useCallback(async (
    amount: number,
    consultationId?: string,
    description?: string
  ): Promise<boolean> => {
    if (!userId) {
      setError('ログインが必要です');
      return false;
    }

    if (!points || points.balance < amount) {
      setError('ポイントが不足しています');
      return false;
    }

    try {
      setError(null);

      // RPCを呼び出してポイント消費
      const { data: newBalance, error: rpcError } = await supabase.rpc('consume_points', {
        p_user_id: userId,
        p_amount: amount,
        p_consultation_id: consultationId,
        p_description: description || 'ポイント消費',
      });

      if (rpcError) {
        throw rpcError;
      }

      // 状態を更新
      await fetchPoints();
      await loadTransactions();

      return true;
    } catch (err) {
      console.error('Error consuming points:', err);
      setError('ポイント消費に失敗しました');
      return false;
    }
  }, [userId, points, fetchPoints, loadTransactions]);

  // 残高確認
  const hasEnoughPoints = useCallback((amount: number): boolean => {
    return !!points && points.balance >= amount;
  }, [points]);

  // 初期ロード
  useEffect(() => {
    fetchPoints();
  }, [fetchPoints]);

  return {
    points,
    transactions,
    isLoading,
    error,
    purchasePoints,
    consumePoints,
    hasEnoughPoints,
    refresh: fetchPoints,
    loadTransactions,
  };
}

// ポイントパッケージ一覧を取得するユーティリティ
export function getPointPackages(): PointPackage[] {
  return POINT_PACKAGES;
}

// ポイント単価の計算ユーティリティ
export function calculatePointCost(
  pricePerMessage: number,
  freeFirstMessage: boolean,
  isFirstMessage: boolean
): number {
  if (freeFirstMessage && isFirstMessage) {
    return 0;
  }
  return pricePerMessage;
}
