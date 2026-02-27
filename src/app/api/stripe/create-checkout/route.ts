import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServerSupabase } from '@/lib/supabase-server';
import { authenticateRequest, unauthorizedResponse, verifyFacilityOwnership, forbiddenResponse } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const auth = await authenticateRequest(request);
    if (!auth) return unauthorizedResponse();

    const { placementId } = await request.json();

    if (!placementId) {
      return NextResponse.json(
        { error: '成約IDが必要です' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Look up placement to get fee_amount and facility_id
    const { data: placement, error: placementErr } = await supabase
      .from('placements')
      .select('id, facility_id, fee_amount, job_type, worker_user_id')
      .eq('id', placementId)
      .single();

    if (placementErr || !placement) {
      return NextResponse.json(
        { error: '成約情報が見つかりません' },
        { status: 404 }
      );
    }

    // 施設の所有権を検証
    const hasAccess = await verifyFacilityOwnership(auth.userId, placement.facility_id);
    if (!hasAccess) return forbiddenResponse('この施設の操作権限がありません');

    // Get or create Stripe customer for the facility
    let stripeCustomerId: string;

    const { data: existing } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('facility_id', placement.facility_id)
      .single();

    if (existing?.stripe_customer_id) {
      stripeCustomerId = existing.stripe_customer_id;
    } else {
      // Fetch facility name for the Stripe customer
      const { data: facility } = await supabase
        .from('facilities')
        .select('name')
        .eq('id', placement.facility_id)
        .single();

      const customer = await stripe.customers.create({
        name: facility?.name || placement.facility_id,
        metadata: { facilityId: placement.facility_id },
      });
      stripeCustomerId = customer.id;

      await supabase.from('stripe_customers').upsert(
        {
          facility_id: placement.facility_id,
          stripe_customer_id: customer.id,
        },
        { onConflict: 'facility_id' }
      );
    }

    // Build origin from request headers
    const origin =
      request.headers.get('origin') ||
      `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: '人材紹介手数料',
              description: `成約ID: ${placementId}`,
            },
            unit_amount: placement.fee_amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/business?view=recruitment&tab=placements&success=true`,
      cancel_url: `${origin}/business?view=recruitment&tab=placements`,
      metadata: { placementId },
    });

    // Update placement with payment intent ID
    if (session.payment_intent) {
      await supabase
        .from('placements')
        .update({
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id,
        })
        .eq('id', placementId);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('create-checkout error:', error);
    return NextResponse.json(
      { error: 'チェックアウトセッション作成に失敗しました' },
      { status: 500 }
    );
  }
}
