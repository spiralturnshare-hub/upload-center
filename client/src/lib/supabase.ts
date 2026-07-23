// ============================================================
// SPIRAL TURN - Supabase クライアント設定（upload-center）
// Green Supabase: fhamrkmsxidxayaoexso
// ============================================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://fhamrkmsxidxayaoexso.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoYW1ya21zeGlkeGF5YW9leHNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTcwMTMsImV4cCI6MjEwMDI3MzAxM30.7GRn0m2SO3BzNQLQAb8dbREpoC8ewSIMLU2gWMIHp5I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ============================================================
// uploads テーブル操作
// ============================================================
export async function fetchUploadByOrderName(orderName: string) {
  const { data, error } = await supabase
    .from('uploads')
    .select(`
      id, created_at, updated_at, order_id, user_id, organization_id,
      order_name, selected_insoles, status,
      insole_user_name, insole_user_kana,
      guest_tf, previous_design_tf, room_color
    `)
    .eq('order_name', orderName)
    .single();
  if (error) throw error;
  return data;
}

export async function insertUpload(upload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('uploads')
    .insert(upload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUploadStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('uploads')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// orders テーブル（注文番号でユーザー認証）
// ============================================================
export async function verifyOrderByPaymentId(paymentId: string, email: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_name, status, customer_email, organization_id')
    .eq('order_name', paymentId)
    .eq('customer_email', email)
    .single();
  if (error) return null;
  return data;
}
