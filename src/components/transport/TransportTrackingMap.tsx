'use client';

import React, { useMemo } from 'react';
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';

interface MapStop {
  order: number;
  childId: string;
  childName: string;
  lat: number;
  lng: number;
  status: 'completed' | 'current' | 'pending';
}

interface TransportTrackingMapProps {
  stops: MapStop[];
  busPosition?: { lat: number; lng: number; heading?: number } | null;
  highlightChildIds?: string[];
  height?: string;
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function TransportTrackingMap({
  stops,
  busPosition,
  highlightChildIds = [],
  height = '100%',
}: TransportTrackingMapProps) {
  // 地図の中心とズームを計算
  const { center, zoom } = useMemo(() => {
    const points: { lat: number; lng: number }[] = [];
    stops.forEach(s => { if (s.lat && s.lng) points.push({ lat: s.lat, lng: s.lng }); });
    if (busPosition?.lat && busPosition?.lng) points.push(busPosition);

    if (points.length === 0) return { center: { lat: 35.68, lng: 139.76 }, zoom: 12 };
    if (points.length === 1) return { center: points[0], zoom: 15 };

    const lats = points.map(p => p.lat);
    const lngs = points.map(p => p.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    const span = Math.max(latSpan, lngSpan);
    const z = span > 0.1 ? 11 : span > 0.05 ? 12 : span > 0.02 ? 13 : span > 0.01 ? 14 : 15;
    return { center: { lat: midLat, lng: midLng }, zoom: z };
  }, [stops, busPosition]);

  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-xl" style={{ height }}>
        <p className="text-gray-500 text-sm">Google Maps APIキーが設定されていません</p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY}>
      <div style={{ height, width: '100%' }} className="rounded-xl overflow-hidden">
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          mapId="transport-tracking"
          disableDefaultUI
          zoomControl
          gestureHandling="greedy"
          style={{ width: '100%', height: '100%' }}
        >
          {/* ストップマーカー */}
          {stops.map((stop) => {
            const isHighlight = highlightChildIds.includes(stop.childId);
            const isCompleted = stop.status === 'completed';
            const isCurrent = stop.status === 'current';

            return (
              <AdvancedMarker
                key={`stop-${stop.order}`}
                position={{ lat: stop.lat, lng: stop.lng }}
                title={stop.childName}
              >
                <div className="relative">
                  {/* パルスエフェクト（ハイライト対象のストップ） */}
                  {isHighlight && !isCompleted && (
                    <div className="absolute -inset-3 rounded-full bg-orange-400/30 animate-ping" />
                  )}
                  <div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2
                      ${isCompleted
                        ? 'bg-gray-300 border-gray-400 text-gray-500'
                        : isCurrent
                        ? 'bg-orange-500 border-orange-600 text-white'
                        : isHighlight
                        ? 'bg-orange-400 border-orange-500 text-white'
                        : 'bg-white border-gray-300 text-gray-700'
                      }
                    `}
                  >
                    {stop.order}
                  </div>
                  {/* ストップ名ラベル */}
                  <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shadow ${
                      isHighlight ? 'bg-orange-500 text-white' : 'bg-white text-gray-700'
                    }`}>
                      {stop.childName}
                      {isHighlight && ' ★'}
                    </span>
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {/* バスマーカー */}
          {busPosition?.lat && busPosition?.lng && (
            <AdvancedMarker
              position={{ lat: busPosition.lat, lng: busPosition.lng }}
              title="送迎車"
            >
              <div
                className="relative"
                style={{
                  transform: busPosition.heading != null ? `rotate(${busPosition.heading}deg)` : undefined,
                }}
              >
                <div className="absolute -inset-2 rounded-full bg-blue-400/20 animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-blue-600 border-3 border-white shadow-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
                  </svg>
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
