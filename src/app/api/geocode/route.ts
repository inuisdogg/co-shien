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
    const { address } = body;

    const encodedAddress = encodeURIComponent(address);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${API_KEY}&language=ja`
    );
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Geocode proxy error:', error);
    return NextResponse.json({ error: 'Failed to geocode address' }, { status: 500 });
  }
}
