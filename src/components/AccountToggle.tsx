"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Switch } from "@/components/Switch";
import { toast } from "@/components/Toast";
import { createClient } from "@/utils/supabase/client";

export function AccountToggle({ id, included, name }: { id: string; included: boolean; name: string }) {
  const router = useRouter();
  const [on, setOn] = useState(included);
  return (
    <Switch
      on={on}
      label={`Include ${name} in totals`}
      title={on ? "Included in totals" : "Hidden from totals"}
      onChange={async () => {
        const next = !on;
        setOn(next);
        // RLS blocks with 0 rows, not an error.
        const { data, error } = await createClient().from("accounts").update({ included: next }).eq("id", id).select("id");
        if (error || !data?.length) return setOn(!next), toast("Couldn't save that. Try again.");
        router.refresh();
      }}
    />
  );
}
