"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMoney } from "@/components/Money";
import type { RetireSettings } from "@/lib/retirement";
import { createClient, updateMeta } from "@/utils/supabase/client";

type Key = "birthYear" | "retireAge" | "monthly" | "returnPct" | "inflationPct" | "withdrawPct" | "otherMonthly" | "goalMonthly";
const FIELDS: { key: Key; label: string; hint: string; unit: "year" | "age" | "money" | "pct"; min: number; max: number }[] = [
  { key: "birthYear", label: "Year you were born", hint: "Sets how many years are left to save.", unit: "year", min: 1926, max: 2010 },
  { key: "retireAge", label: "Retire at", hint: "The age you want to stop working.", unit: "age", min: 40, max: 80 },
  { key: "monthly", label: "Put in each month", hint: "Into 401(k), IRA and brokerage accounts, employer match included.", unit: "money", min: 0, max: 1_000_000 },
  { key: "otherMonthly", label: "Other income a month in retirement", hint: "Social Security, a pension or rent, in today's money. Your estimate is at ssa.gov.", unit: "money", min: 0, max: 1_000_000 },
  { key: "goalMonthly", label: "Income you want a month in retirement", hint: "Your goal, in today's money. The gauge at the top measures against it. Leave empty for no goal.", unit: "money", min: 0, max: 1_000_000 },
  { key: "returnPct", label: "Return a year", hint: "Before inflation. Not guaranteed.", unit: "pct", min: 0, max: 15 },
  { key: "inflationPct", label: "Inflation a year", hint: "Results are shown in today's money.", unit: "pct", min: 0, max: 10 },
  { key: "withdrawPct", label: "Taken out a year once retired", hint: "4% is a common rule of thumb.", unit: "pct", min: 1, max: 10 },
];

// The assumptions behind the projection. Each saves when you leave its box (user_metadata.retirement).
export function RetirementFields({ settings }: { settings: RetireSettings }) {
  const router = useRouter();
  const { symbol } = useMoney();
  const [v, setV] = useState<Record<Key, string>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, settings[f.key] == null || (f.key === "goalMonthly" && !settings[f.key]) ? "" : String(settings[f.key])])) as Record<Key, string>);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    const next: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = v[f.key].trim();
      if (raw === "") {
        if (f.key !== "birthYear" && f.key !== "goalMonthly") return setErr(`${f.label} needs a number.`);
        next[f.key] = f.key === "goalMonthly" ? 0 : null;
        continue;
      }
      const n = Number(raw);
      if (!(n >= f.min && n <= f.max)) return setErr(`${f.label} should be between ${f.min} and ${f.max}.`);
      next[f.key] = n;
    }
    setErr("");
    setSaving(true);
    const { error } = await updateMeta(createClient(), { data: { retirement: next } });
    setSaving(false);
    if (error) return setErr("Couldn't save that. Try again.");
    router.refresh();
  }
  const box = "flex items-center border border-line rounded-xl px-3 h-10 bg-surface focus-within:border-ink";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 @md:grid-cols-2 gap-x-4 gap-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="space-y-1 text-xs text-muted block">{f.label}
            <span className={box}>
              {f.unit === "money" && <span className="text-sm text-muted mr-1">{symbol}</span>}
              <input
                inputMode={f.unit === "pct" || f.unit === "money" ? "decimal" : "numeric"}
                value={v[f.key]}
                onChange={(e) => setV({ ...v, [f.key]: e.target.value.replace(f.unit === "pct" || f.unit === "money" ? /[^\d.]/g : /[^\d]/g, "") })}
                onBlur={save}
                placeholder={f.key === "birthYear" ? "e.g. 1985" : ""}
                aria-label={f.label}
                className="w-full text-sm text-ink tabular outline-none bg-transparent"
              />
              {f.unit === "pct" && <span className="text-sm text-muted">%</span>}
            </span>
            <span className="block">{f.hint}</span>
          </label>
        ))}
      </div>
      {err ? <p className="text-sm text-bad">{err}</p> : saving ? <p className="text-sm text-muted">Saving...</p> : null}
    </div>
  );
}
