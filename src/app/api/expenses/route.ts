import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Expenses API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    const { data, error } = await supabase.from('expenses').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Expenses POST error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Expenses DELETE error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
