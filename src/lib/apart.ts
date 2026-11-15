// Money you look after for someone else (a child's savings, say): shown on its own page and left out of your totals.
// Off unless NEXT_PUBLIC_APART_NAME is set in .env.local to the word that marks their accounts, usually their first
// name. An account belongs here when that word is in its name; rename one with the pencil on the Accounts page.
const NAME = (process.env.NEXT_PUBLIC_APART_NAME ?? "").trim();
export const APART = NAME ? { name: NAME, href: "/apart", match: new RegExp(NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") } : null;
export const isApart = (a: { name: string; custom_name?: string | null }) => !!APART && (APART.match.test(a.custom_name || a.name) || APART.match.test(a.name));
