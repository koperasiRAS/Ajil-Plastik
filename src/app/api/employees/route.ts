import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Employees API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// Create new employee - creates user in Supabase Auth and users table
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();

  try {
    const body = await req.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['owner', 'employee'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Create user in Supabase Auth using service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const authClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const { data: authData, error: authError } = await authClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: { name, role }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Create user record in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role
      })
      .select()
      .single();

    if (userError) {
      console.error('User table insert error:', userError);
      // Try to delete auth user if users table fails
      await authClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    return NextResponse.json(userData);
  } catch (err) {
    console.error('Employee creation error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// Update employee name/role — uses service role key to bypass RLS
export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    const { id, name, role } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (role && (role === 'owner' || role === 'employee')) updates.role = role;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Employee update error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
