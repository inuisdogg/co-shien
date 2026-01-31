'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Coins,
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
  Star,
  Gift,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { usePoints } from '@/hooks/usePoints';
import { POINT_PACKAGES, PointPackage } from '@/types/expert';

export const dynamic = 'force-dynamic';

export default function ClientPointsPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; userType: string } | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<PointPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchasedPoints, setPurchasedPoints] = useState(0);

  const { points, transactions, isLoading, purchasePoints, refresh } = usePoints(user?.id);

  // ユーザー情報取得
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed.userType !== 'client' && parsed.userType !== 'staff') {
          router.push('/parent/login');
          return;
        }
        setUser(parsed);
      } catch (e) {
        router.push('/parent/login');
      }
    } else {
      router.push('/parent/login');
    }
  }, [router]);

  const handlePurchase = async (pkg: PointPackage) => {
    if (!user) return;

    setSelectedPackage(pkg);
    setIsPurchasing(true);

    try {
      // モック決済 - 実際には決済画面に遷移
      await new Promise(resolve => setTimeout(resolve, 1500));

      const success = await purchasePoints(pkg.id);

      if (success) {
        setPurchasedPoints(pkg.points + pkg.bonusPoints);
        setShowSuccess(true);
        await refresh();
      }
    } catch (err) {
      console.error('Purchase error:', err);
    } finally {
      setIsPurchasing(false);
      setSelectedPackage(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const transactionTypeLabels = {
    purchase: '購入',
    consume: '相談利用',
    refund: '返金',
    bonus: 'ボーナス',
    expire: '期限切れ',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg text-gray-900">ポイント</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* 残高カード */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5" />
            <span className="text-emerald-100">保有ポイント</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">{points?.balance || 0}</span>
            <span className="text-emerald-100">pt</span>
          </div>
        </div>

        {/* ポイントパッケージ */}
        <section className="mb-8">
          <h2 className="font-bold text-gray-900 mb-4">ポイントを購入</h2>
          <div className="grid grid-cols-2 gap-3">
            {POINT_PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handlePurchase(pkg)}
                disabled={isPurchasing}
                className={`relative bg-white rounded-xl p-4 text-left shadow-sm border-2 transition-all ${
                  isPurchasing && selectedPackage?.id === pkg.id
                    ? 'border-emerald-500 opacity-70'
                    : 'border-transparent hover:border-emerald-200'
                }`}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-2 -right-2">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-full">
                      <Star className="w-3 h-3" />
                      人気
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <span className="text-lg font-bold text-gray-900">{pkg.label}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold text-emerald-600">¥{pkg.price.toLocaleString()}</span>
                </div>
                {pkg.bonusPoints > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Gift className="w-3.5 h-3.5" />
                    +{pkg.bonusPoints}pt ボーナス
                  </div>
                )}
                {isPurchasing && selectedPackage?.id === pkg.id && (
                  <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
            <CreditCard className="w-3.5 h-3.5" />
            クレジットカード・Apple Pay・Google Pay対応
          </p>
        </section>

        {/* 取引履歴 */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">取引履歴</h2>
          </div>
          {transactions.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">取引履歴がありません</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl divide-y divide-gray-100">
              {transactions.slice(0, 10).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.amount > 0
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {tx.amount > 0 ? (
                        <Coins className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {transactionTypeLabels[tx.transactionType as keyof typeof transactionTypeLabels] || tx.transactionType}
                      </p>
                      {tx.description && (
                        <p className="text-xs text-gray-500 truncate max-w-[180px]">
                          {tx.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        {formatDate(tx.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-bold ${
                        tx.amount > 0 ? 'text-emerald-600' : 'text-gray-600'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount} pt
                    </span>
                    <p className="text-xs text-gray-400">残高: {tx.balanceAfter} pt</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 購入成功モーダル */}
      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              購入完了!
            </h3>
            <p className="text-gray-500 mb-2">
              {purchasedPoints} ポイントを購入しました
            </p>
            <p className="text-sm text-emerald-600 font-medium mb-6">
              現在の残高: {points?.balance || 0} pt
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="w-full py-3 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors"
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
