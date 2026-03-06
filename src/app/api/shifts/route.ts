import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*, users(name)')
      .order('start_time', { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Shifts API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
