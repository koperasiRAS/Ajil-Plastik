import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

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
