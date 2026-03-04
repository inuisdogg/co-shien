import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export async function POST(req: NextRequest) {
  // 内部プロキシAPI（Google Maps APIキー保護のため）
  // クライアントから直接呼ばれるため、ユーザー認証はミドルウェアで制御
  if (!API_KEY) {
    return NextResponse.json({ error: 'Google Maps API key is not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { origin, destination, waypoints, language = 'ja', mode = 'driving' } = body;

    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    if (waypoints) url.searchParams.set('waypoints', waypoints);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', language);
    url.searchParams.set('mode', mode);

    const response = await fetch(url.toString());
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Directions proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch directions' }, { status: 500 });
  }
}
