import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name)')
      .order('name');
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Products API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    const { data, error } = await supabase.from('products').insert(body).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Products POST error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Products PUT error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Products DELETE error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
