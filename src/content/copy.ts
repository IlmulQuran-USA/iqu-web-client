/*
 * Helpers for writing status-tagged copy (see COPY_STATUSES in ./types).
 *   live(…)      the owner's own wording
 *   draft(…)     written to fill a gap; needs the owner's approval before launch
 *   pending      not supplied yet: empty, never invented
 * `npm run content:check` lists every draft and pending item.
 */

export const live = (text: string) => ({ status: "live", text }) as const;
export const draft = (text: string) => ({ status: "draft", text }) as const;
export const pending = { status: "pending", text: null } as const;

export const liveList = (items: string[]) => ({ status: "live", items }) as const;
export const draftList = (items: string[]) => ({ status: "draft", items }) as const;
export const pendingList = { status: "pending", items: [] as string[] } as const;
