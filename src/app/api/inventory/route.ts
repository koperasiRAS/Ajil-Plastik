import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await createServerSupabase();
  try {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, stock, sku, categories(name)')
      .order('stock', { ascending: true });
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Inventory API error:', err);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
