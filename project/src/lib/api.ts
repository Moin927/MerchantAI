import { supabase } from '@/lib/supabase';
import type { Product, Customer, Supplier, Transaction, Invoice, Payment } from '@/lib/types';

// ============ Products ============
export async function fetchProducts(search = '', page = 1, perPage = 20) {
  let query = supabase.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;
  return { data: data as Product[], total: count ?? 0 };
}

export async function fetchProduct(id: string) {
  const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Product | null;
}

export async function fetchInventoryMovements(productId: string) {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, product:products(*)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// ============ Customers ============
export async function fetchCustomers(search = '', page = 1, perPage = 20) {
  let query = supabase.from('customers').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { data: data as Customer[], total: count ?? 0 };
}

export async function fetchCustomer(id: string) {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Customer | null;
}

// ============ Suppliers ============
export async function fetchSuppliers(search = '', page = 1, perPage = 20) {
  let query = supabase.from('suppliers').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { data: data as Supplier[], total: count ?? 0 };
}

export async function fetchSupplier(id: string) {
  const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Supplier | null;
}

// ============ Transactions ============
export async function fetchTransactions(
  type?: string,
  search = '',
  page = 1,
  perPage = 20
) {
  let query = supabase
    .from('transactions')
    .select('*, customer:customers(*), supplier:suppliers(*)', { count: 'exact' })
    .order('occurred_at', { ascending: false });

  if (type && type !== 'all') {
    query = query.eq('transaction_type', type);
  }
  if (search) {
    query = query.or(`transaction_number.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { data: data as Transaction[], total: count ?? 0 };
}

export async function fetchTransaction(id: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*, customer:customers(*), supplier:suppliers(*), items:transaction_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Transaction | null;
}

// ============ Invoices ============
export async function fetchInvoices(search = '', page = 1, perPage = 20) {
  let query = supabase
    .from('invoices')
    .select('*, customer:customers(*)', { count: 'exact' })
    .order('created_at', { ascending: false });
  if (search) {
    query = query.or(`invoice_number.ilike.%${search}%,notes.ilike.%${search}%`);
  }
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { data: data as Invoice[], total: count ?? 0 };
}

export async function fetchInvoice(id: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(*), items:invoice_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as Invoice | null;
}

// ============ Payments ============
export async function fetchPayments(page = 1, perPage = 20) {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await supabase
    .from('payments')
    .select('*, customer:customers(*), supplier:suppliers(*)', { count: 'exact' })
    .order('paid_at', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data as Payment[], total: count ?? 0 };
}

// ============ RPC wrappers ============
export async function callRpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
