/**
 * 実務経験証明書PDF生成API
 * 署名済みの証明書をPDFとして生成
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント（Anon Key使用）
function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recordId = searchParams.get('recordId');
    const token = searchParams.get('token');

    if (!recordId && !token) {
      return NextResponse.json(
        { error: 'recordIdまたはtokenが必要です' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // レコードを取得
    let query = supabase.from('work_experience_records').select('*');

    if (recordId) {
      query = query.eq('id', recordId);
    } else if (token) {
      query = query.eq('signature_token', token);
    }

    const { data: record, error: fetchError } = await query.single();

    if (fetchError || !record) {
      return NextResponse.json(
        { error: 'レコードが見つかりません' },
        { status: 404 }
      );
    }

    // 署名済みでない場合はエラー
    if (record.status !== 'signed') {
      return NextResponse.json(
        { error: 'この証明書はまだ署名されていません' },
        { status: 400 }
      );
    }

    // 申請者情報を取得
    const { data: userData } = await supabase
      .from('users')
      .select('name, name_kana, birth_date')
      .eq('id', record.user_id)
      .single();

    // PDFダウンロード用のデータを返す
    // クライアント側でhtml2canvas + jspdfを使用してPDF生成
    return NextResponse.json({
      success: true,
      record: {
        ...record,
        applicant: userData,
      },
    });
  } catch (error: any) {
    console.error('Generate certificate PDF error:', error);
    return NextResponse.json(
      { error: error.message || 'PDF生成に失敗しました' },
      { status: 500 }
    );
  }
}
