'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bus, Clock, MapPin, CheckCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useTransportTracker } from '@/hooks/useTransportTracker';
import { formatEtaMinutes } from '@/utils/geo';
import dynamic from 'next/dynamic';

const TransportTrackingMap = dynamic(
  () => import('@/components/transport/TransportTrackingMap'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center bg-gray-100" style={{ height: '55vh' }}>
      <div className="w-6 h-6 border-2 border-client border-t-transparent rounded-full animate-spin" />
    </div>
  )}
);

export default function TransportTrackingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const facilityId = params.facilityId as string;
  const sessionParam = searchParams.get('session');

  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try { setUser(JSON.parse(userStr)); } catch {}
    }
  }, []);

  const {
    session,
    myChildIds,
    myChildStopIndex,
    etaToMyStop,
    connectionStatus,
    isLocationStale,
    loading,
    error,
  } = useTransportTracker(facilityId, user?.id, sessionParam);

  const modeLabel = session?.mode === 'pickup' ? 'お迎え' : 'お送り';
  const isActive = session?.status === 'active';
  const isCompleted = session?.status === 'completed';
  const isConnected = connectionStatus === 'SUBSCRIBED';

  // マップ用のストップデータ
  const mapStops = (session?.routeStops || []).map((stop, i) => ({
    order: stop.order,
    childId: stop.childId,
    childName: stop.childName,
    lat: stop.lat,
    lng: stop.lng,
    status: (i < (session?.currentStopIndex || 0) ? 'completed'
      : i === (session?.currentStopIndex || 0) ? 'current'
      : 'pending') as 'completed' | 'current' | 'pending',
  }));

  const busPosition = (session?.currentLatitude && session?.currentLongitude) ? {
    lat: session.currentLatitude,
    lng: session.currentLongitude,
    heading: session.currentHeading,
  } : null;

  // 保護者の全児童をハイライト対象に
  const highlightChildIds = myChildIds.filter(id =>
    session?.routeStops.some(s => s.childId === id)
  );

  // 自分の子の位置を全取得
  const myChildStopIndices = (session?.routeStops || [])
    .map((s, i) => myChildIds.includes(s.childId) ? i : -1)
    .filter(i => i >= 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-client-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-client" />
      </div>
    );
  }

  // セッションなし
  if (!session) {
    return (
      <div className="min-h-screen bg-client-light">
        <Header onBack={() => router.back()} />
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <Bus className="w-16 h-16 text-gray-300 mb-4" />
          <h2 className="text-lg font-bold text-gray-700 mb-2">送迎情報はありません</h2>
          <p className="text-sm text-gray-500 text-center">
            現在、アクティブな送迎はありません。<br />
            送迎が開始されるとプッシュ通知でお知らせします。
          </p>
        </div>
      </div>
    );
  }

  // 完了
  if (isCompleted) {
    return (
      <div className="min-h-screen bg-client-light">
        <Header onBack={() => router.back()} />
        <div className="flex flex-col items-center justify-center px-6 py-20">
          <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
          <h2 className="text-lg font-bold text-gray-700 mb-2">{modeLabel}が完了しました</h2>
          {session.completedAt && (
            <p className="text-sm text-gray-500">
              完了時刻: {new Date(session.completedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-client-light flex flex-col">
      {/* ヘッダー */}
      <Header onBack={() => router.back()} />

      {/* 接続ステータス */}
      {!isConnected && isActive && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2 text-sm text-yellow-700">
          <WifiOff className="w-4 h-4" />
          再接続中...
        </div>
      )}

      {/* 位置情報が古い警告 */}
      {isLocationStale && isActive && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2 text-sm text-orange-700">
          <AlertCircle className="w-4 h-4" />
          位置情報が更新されていません（{session.locationUpdatedAt
            ? `${Math.floor((Date.now() - new Date(session.locationUpdatedAt).getTime()) / 60000)}分前`
            : ''
          }）
        </div>
      )}

      {/* マップ（55vh） */}
      <div style={{ height: '55vh', flexShrink: 0 }}>
        <TransportTrackingMap
          stops={mapStops}
          busPosition={busPosition}
          highlightChildIds={highlightChildIds}
          height="100%"
        />
      </div>

      {/* 情報パネル */}
      <div className="flex-1 bg-white rounded-t-3xl -mt-4 shadow-lg border-t border-gray-100 overflow-auto" style={{ paddingBottom: 'var(--safe-area-bottom, 20px)' }}>
        {/* ETAバー */}
        {isActive && etaToMyStop !== null && etaToMyStop > 0 && (
          <div className="bg-gradient-to-r from-client to-client-dark px-6 py-4 rounded-t-3xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-xs font-bold">
                  {modeLabel}中
                  {myChildStopIndex !== null && ` · お子様は${myChildStopIndex + 1}番目（全${session.routeStops.length}箇所）`}
                </p>
                <p className="text-white text-2xl font-bold">
                  あと{formatEtaMinutes(etaToMyStop)}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {isConnected ? (
                  <Wifi className="w-4 h-4 text-white/70" />
                ) : (
                  <WifiOff className="w-4 h-4 text-white/70" />
                )}
                <span className="text-xs text-white/70">LIVE</span>
              </div>
            </div>
            {/* 進捗バー */}
            <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white/70 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((session.currentStopIndex || 0) / session.routeStops.length) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {isActive && (etaToMyStop === null || etaToMyStop === 0) && myChildStopIndex !== null && session.currentStopIndex > myChildStopIndex && (
          <div className="bg-green-500 px-6 py-4 rounded-t-3xl">
            <p className="text-white text-lg font-bold flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              お子様の地点を通過しました
            </p>
          </div>
        )}

        {/* 準備中ステータス */}
        {session.status === 'preparing' && (
          <div className="bg-blue-50 px-6 py-4 rounded-t-3xl">
            <p className="text-blue-700 font-bold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              送迎準備中です。開始時に通知します。
            </p>
          </div>
        )}

        {/* ストップリスト */}
        <div className="px-4 py-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-client" />
            ルート（{session.routeStops.length}箇所）
          </h3>
          <div className="space-y-1">
            {session.routeStops.map((stop, i) => {
              const isMyChild = myChildIds.includes(stop.childId);
              const isCompleted = i < (session.currentStopIndex || 0);
              const isCurrent = i === (session.currentStopIndex || 0) && isActive;

              return (
                <div
                  key={`${stop.childId}-${i}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    isMyChild && !isCompleted
                      ? 'bg-orange-50 border border-orange-200'
                      : isCompleted
                      ? 'bg-gray-50'
                      : isCurrent
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-white'
                  }`}
                >
                  {/* ステータスアイコン */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isCompleted
                      ? 'bg-gray-300 text-gray-500'
                      : isCurrent
                      ? 'bg-blue-500 text-white'
                      : isMyChild
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>

                  {/* 情報 */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {stop.childName}
                      {isMyChild && <span className="text-orange-500 ml-1 text-xs">（お子様）</span>}
                    </p>
                    {stop.address && (
                      <p className="text-xs text-gray-500 truncate">{stop.address}</p>
                    )}
                  </div>

                  {/* ETA or ステータス */}
                  <div className="flex-shrink-0 text-right">
                    {isCompleted ? (
                      <span className="text-xs text-gray-400">完了</span>
                    ) : isCurrent && session.nextStopEtaSeconds ? (
                      <span className="text-xs font-bold text-blue-600">
                        {formatEtaMinutes(session.nextStopEtaSeconds)}
                      </span>
                    ) : isMyChild && !isCompleted && etaToMyStop !== null && etaToMyStop > 0 ? (
                      <span className="text-xs font-bold text-orange-600">
                        あと{formatEtaMinutes(etaToMyStop)}
                      </span>
                    ) : isMyChild && !isCompleted && session.currentStopIndex > i ? (
                      <span className="text-xs text-green-600 font-bold">通過済み</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 最終更新時刻 */}
        {session.locationUpdatedAt && isActive && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-400 text-center">
              最終更新: {new Date(session.locationUpdatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10" style={{ paddingTop: 'calc(var(--safe-area-top, 0px) + 12px)' }}>
      <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-lg">
        <ArrowLeft className="w-5 h-5 text-gray-700" />
      </button>
      <div className="flex items-center gap-2">
        <Bus className="w-5 h-5 text-client" />
        <h1 className="text-lg font-bold text-gray-800">送迎トラッキング</h1>
      </div>
    </div>
  );
}
