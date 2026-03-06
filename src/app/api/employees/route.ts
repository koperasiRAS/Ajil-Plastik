import { NextResponse } from 'next/server';
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
