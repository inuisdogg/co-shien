import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { verifyPassword, hashPassword, isLegacyHash } from '@/utils/password';

interface LoginRequest {
  facilityCode: string;
  loginId: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { facilityCode, loginId, password } = body;

    if (!loginId || !password) {
      return NextResponse.json(
        { error: 'ログインIDとパスワードは必須です' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();
    const isEmail = loginId.includes('@');

    // ===== Personal側ログイン（施設コードなし）=====
    if (!facilityCode || facilityCode.trim() === '') {
      return handlePersonalLogin(supabase, loginId, password, isEmail);
    }

    // ===== Business側ログイン（施設コードあり）=====
    const { data: rawFacility, error: facilityError } = await supabase
      .from('facilities')
      .select('id, name, code, owner_user_id, created_at, updated_at')
      .eq('code', facilityCode)
      .single();

    if (facilityError || !rawFacility) {
      return NextResponse.json(
        { error: '施設IDが正しくありません' },
        { status: 401 }
      );
    }

    const facilityData = rawFacility as Record<string, unknown>;

    // usersテーブルから検索
    let userResult;
    if (isEmail) {
      userResult = await supabase
        .from('users')
        .select('id, email, name, last_name, first_name, last_name_kana, first_name_kana, birth_date, gender, login_id, user_type, role, facility_id, permissions, account_status, has_account, password_hash, created_at, updated_at')
        .eq('facility_id', facilityData.id as string)
        .eq('email', loginId)
        .eq('has_account', true)
        .single();
    } else {
      userResult = await supabase
        .from('users')
        .select('id, email, name, last_name, first_name, last_name_kana, first_name_kana, birth_date, gender, login_id, user_type, role, facility_id, permissions, account_status, has_account, password_hash, created_at, updated_at')
        .eq('facility_id', facilityData.id as string)
        .eq('login_id', loginId)
        .eq('has_account', true)
        .single();
    }

    if (!userResult.error && userResult.data) {
      const userData = userResult.data as Record<string, unknown>;
      return handleUserAuth(supabase, userData, password, facilityData);
    }

    // staffテーブルから検索（後方互換性）
    let staffResult;
    if (isEmail) {
      staffResult = await supabase
        .from('staff')
        .select('id, user_id, name, email, login_id, role, facility_id, password_hash, has_account, created_at, updated_at')
        .eq('facility_id', facilityData.id as string)
        .eq('email', loginId)
        .eq('has_account', true)
        .single();
    } else {
      staffResult = await supabase
        .from('staff')
        .select('id, user_id, name, email, login_id, role, facility_id, password_hash, has_account, created_at, updated_at')
        .eq('facility_id', facilityData.id as string)
        .eq('name', loginId)
        .eq('has_account', true)
        .single();
    }

    if (staffResult.error || !staffResult.data) {
      return NextResponse.json(
        { error: 'ログインIDまたはパスワードが正しくありません' },
        { status: 401 }
      );
    }

    const staffData = staffResult.data as Record<string, unknown>;
    return handleStaffAuth(supabase, staffData, password, facilityData);
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

async function handlePersonalLogin(
  supabase: ReturnType<typeof createServerSupabase>,
  loginId: string,
  password: string,
  isEmail: boolean,
) {
  let result;
  if (isEmail) {
    result = await supabase
      .from('users')
      .select('id, email, name, last_name, first_name, last_name_kana, first_name_kana, birth_date, gender, login_id, user_type, role, facility_id, permissions, account_status, has_account, password_hash, created_at, updated_at')
      .eq('email', loginId)
      .eq('has_account', true)
      .single();
  } else {
    result = await supabase
      .from('users')
      .select('id, email, name, last_name, first_name, last_name_kana, first_name_kana, birth_date, gender, login_id, user_type, role, facility_id, permissions, account_status, has_account, password_hash, created_at, updated_at')
      .eq('login_id', loginId)
      .eq('has_account', true)
      .single();
  }

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: 'ログインIDまたはパスワードが正しくありません' },
      { status: 401 }
    );
  }

  const userData = result.data as Record<string, unknown>;

  if (!userData.password_hash) {
    return NextResponse.json(
      { error: 'このアカウントにはパスワードが設定されていません' },
      { status: 401 }
    );
  }

  const isValid = await verifyPassword(password, userData.password_hash as string);
  if (!isValid) {
    return NextResponse.json(
      { error: 'ログインIDまたはパスワードが正しくありません' },
      { status: 401 }
    );
  }

  await maybeUpgradeHash(supabase, 'users', userData.id as string, password, userData.password_hash as string);

  const { password_hash: _, ...safeUser } = userData;
  return NextResponse.json({ user: safeUser, facility: null });
}

async function handleUserAuth(
  supabase: ReturnType<typeof createServerSupabase>,
  userData: Record<string, unknown>,
  password: string,
  facilityData: Record<string, unknown>,
) {
  if (!userData.password_hash) {
    return NextResponse.json(
      { error: 'このアカウントにはパスワードが設定されていません' },
      { status: 401 }
    );
  }

  const isValid = await verifyPassword(password, userData.password_hash as string);
  if (!isValid) {
    return NextResponse.json(
      { error: 'ログインIDまたはパスワードが正しくありません' },
      { status: 401 }
    );
  }

  await maybeUpgradeHash(supabase, 'users', userData.id as string, password, userData.password_hash as string);

  const { data: rawSettings } = await supabase
    .from('facility_settings')
    .select('facility_name')
    .eq('facility_id', userData.facility_id as string)
    .single();

  const facilitySettings = rawSettings as Record<string, unknown> | null;

  const facility = {
    id: facilityData.id,
    name: (facilitySettings?.facility_name as string) || facilityData.name,
    code: facilityData.code || facilityData.id,
    ownerUserId: facilityData.owner_user_id,
    createdAt: facilityData.created_at,
    updatedAt: facilityData.updated_at,
  };

  const { password_hash: _, ...safeUser } = userData;
  return NextResponse.json({ user: safeUser, facility });
}

async function handleStaffAuth(
  supabase: ReturnType<typeof createServerSupabase>,
  staffData: Record<string, unknown>,
  password: string,
  facilityData: Record<string, unknown>,
) {
  if (!staffData.password_hash) {
    return NextResponse.json(
      { error: 'このスタッフにはアカウントが設定されていません' },
      { status: 401 }
    );
  }

  const isValid = await verifyPassword(password, staffData.password_hash as string);
  if (!isValid) {
    return NextResponse.json(
      { error: 'ログインIDまたはパスワードが正しくありません' },
      { status: 401 }
    );
  }

  await maybeUpgradeHash(supabase, 'staff', staffData.id as string, password, staffData.password_hash as string);

  const { data: rawSettings } = await supabase
    .from('facility_settings')
    .select('facility_name')
    .eq('facility_id', staffData.facility_id as string)
    .single();

  const facilitySettings = rawSettings as Record<string, unknown> | null;

  const facility = {
    id: staffData.facility_id,
    name: (facilitySettings?.facility_name as string) || facilityData.name,
    code: facilityData.code || staffData.facility_id,
    ownerUserId: facilityData.owner_user_id,
    createdAt: facilityData.created_at,
    updatedAt: facilityData.updated_at,
  };

  const user = {
    id: (staffData.user_id || staffData.id) as string,
    email: (staffData.email as string) || '',
    name: staffData.name as string,
    login_id: (staffData.login_id || staffData.name) as string,
    user_type: 'staff',
    role: (staffData.role === 'マネージャー' || staffData.role === '管理者') ? 'admin' : 'staff',
    facility_id: staffData.facility_id as string,
    permissions: {},
    account_status: 'active',
    created_at: staffData.created_at,
    updated_at: staffData.updated_at,
  };

  return NextResponse.json({ user, facility });
}

async function maybeUpgradeHash(
  supabase: ReturnType<typeof createServerSupabase>,
  table: 'users' | 'staff',
  id: string,
  password: string,
  currentHash: string,
) {
  if (isLegacyHash(currentHash)) {
    try {
      const newHash = await hashPassword(password);
      await supabase
        .from(table)
        .update({ password_hash: newHash })
        .eq('id', id);
    } catch (err) {
      console.error(`Hash upgrade failed for ${table}/${id}:`, err);
    }
  }
}
