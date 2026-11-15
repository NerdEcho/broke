import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { retireSettings } from "@/lib/retirement";

/** What is in investment accounts today (the ones switched on), and the saved Retirement page settings. */
export async function retirementInputs(supabase: SupabaseClient, userId: string, meta: Record<string, unknown> | null | undefined) {
  const { data } = await supabase.from("accounts").select("name, custom_name, subtype, balance:home_balance, included").eq("user_id", userId).eq("type", "investment");
  const accounts = ((data ?? []) as { name: string; custom_name: string | null; subtype: string | null; balance: number | null; included: boolean }[])
    .filter((a) => a.included)
    .map((a) => ({ name: a.custom_name || a.name, subtype: a.subtype, balance: Number(a.balance ?? 0) }))
    .sort((a, b) => b.balance - a.balance);
  const thisYear = new Date().getFullYear();
  return { accounts, invested: accounts.reduce((s, a) => s + a.balance, 0), settings: retireSettings(meta?.retirement, thisYear), thisYear };
}
