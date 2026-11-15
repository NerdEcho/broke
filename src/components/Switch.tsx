"use client";

// The on/off switch used wherever something is counted or left out: accounts in totals, recurring charges in the list.
// Green and to the right is on. `label` names what it controls for screen readers; `title` is the hover text.
export function Switch({ on, onChange, label, title }: { on: boolean; onChange: () => void; label: string; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={title}
      onClick={onChange}
      className={`w-10 h-6 rounded-full p-0.5 shrink-0 transition ${on ? "bg-good" : "bg-line"}`}
    >
      <span className={`block size-5 rounded-full bg-white shadow transition ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}
