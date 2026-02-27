import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerSupabase } from '@/lib/supabase-server';
import { authenticateRequest, unauthorizedResponse, verifyFacilityOwnership, forbiddenResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const auth = await authenticateRequest(request);
    if (!auth) return unauthorizedResponse();

    const { facilityId, facilityName } = await request.json();

    if (!facilityId) {
      return NextResponse.json(
        { error: '施設IDが必要です' },
        { status: 400 }
      );
    }

    // 施設の所有権を検証
    const hasAccess = await verifyFacilityOwnership(auth.userId, facilityId);
    if (!hasAccess) return forbiddenResponse('この施設の操作権限がありません');

    // Create Stripe customer
    const customer = await stripe.customers.create({
      name: facilityName || facilityId,
      metadata: { facilityId },
    });

    // Upsert into stripe_customers table
    const supabase = createServerSupabase();
    const { error: dbError } = await supabase
      .from('stripe_customers')
      .upsert(
        {
          facility_id: facilityId,
          stripe_customer_id: customer.id,
        },
        { onConflict: 'facility_id' }
      );

    if (dbError) {
      console.error('stripe_customers upsert error:', dbError);
      return NextResponse.json(
        { error: 'データベース更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ customerId: customer.id });
  } catch (error) {
    console.error('create-customer error:', error);
    return NextResponse.json(
      { error: 'Stripe顧客作成に失敗しました' },
      { status: 500 }
    );
  }
}
