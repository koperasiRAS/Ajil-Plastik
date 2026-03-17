import { createServerSupabase } from '@/lib/supabase-server';
import PosClient from './PosClient';
import { Product, Category } from '@/lib/types';

// Server Component (RSC) to handle fast initial loads
export default async function POSPage() {
  const supabase = await createServerSupabase();

  // Get current user and their store
  const { data: { session } } = await supabase.auth.getSession();
  let storeId: string | null = null;

  if (session?.user) {
    const { data: userData } = await supabase
      .from('users')
      .select('store_id')
      .eq('id', session.user.id)
      .single();
    storeId = userData?.store_id || null;
  }

  // Build query based on store
  const productsQuery = storeId
    ? supabase.from('products').select('*, categories(name)').eq('store_id', storeId).or('is_active.is.true,is_active.is.null').order('name')
    : supabase.from('products').select('*, categories(name)').or('is_active.is.true,is_active.is.null').order('name');

  // Load products and categories in parallel directly on the server
  // This bypasses the need for the browser to run effect hooks and loading spinners
  // Only fetch active products (is_active=true or null for backward compatibility)
  const [prodRes, catRes] = await Promise.all([
    productsQuery,
    supabase.from('categories').select('*').order('name')
  ]);

  let productsData: Product[] = [];
  if (prodRes.error) {
    const fallback = await supabase.from('products').select('*').order('name');
    productsData = (fallback.data as Product[]) || [];
  } else {
    productsData = (prodRes.data as Product[]) || [];
  }

  const categoriesData = (catRes.data as Category[]) || [];

  return (
    <PosClient
      initialProducts={productsData}
      initialCategories={categoriesData}
    />
  );
}
