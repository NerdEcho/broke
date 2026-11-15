"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/Switch";
import { toast } from "@/components/Toast";
import { createClient } from "@/utils/supabase/client";

// Optimistic: the switch flips at once, a failed write (or 0 rows from RLS) puts it back.
// On: counted as a recurring charge (Coming up, safe to spend, the subscription total). Off: hidden from them.
export function RecurringToggle({ id, active, name }: { id: string; active: boolean; name?: string }) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  return (
    <Switch
      on={on}
      label={`Count ${name ?? "this charge"} as recurring`}
      title={on ? "Counted as recurring. Switch off to hide it." : "Hidden. Switch on to count it again."}
      onChange={async () => {
        const next = !on;
        setOn(next);
        const { data, error } = await createClient().from("recurring").update({ active: next }).eq("id", id).select("id");
        if (error || !data?.length) return setOn(!next), toast("Couldn't save that. Try again.");
        router.refresh();
      }}
    />
  );
}
