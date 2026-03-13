import { createServerSupabase } from '@/lib/supabase-server';
import PosClient from './PosClient';
import { Product, Category } from '@/lib/types';

// Server Component (RSC) to handle fast initial loads
export default async function POSPage() {
  const supabase = await createServerSupabase();

  // Load products and categories in parallel directly on the server
  // This bypasses the need for the browser to run effect hooks and loading spinners
  // Only fetch active products (is_active=true) for POS — archived products are hidden
  const [prodRes, catRes] = await Promise.all([
    supabase.from('products').select('*, categories(name)').neq('is_active', false).order('name'),
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
