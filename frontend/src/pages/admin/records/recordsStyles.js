export const INPUT =
  "h-11 w-full rounded-xl border border-line bg-surface-white px-3 text-sm text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale";

export const TEXTAREA =
  "w-full resize-none rounded-xl border border-line bg-surface-white px-3 py-2.5 text-sm leading-6 text-content outline-none transition placeholder:text-content-subtle focus:border-brand focus:ring-2 focus:ring-brand-pale";

export const BTN =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export const BTN_NAVY = `${BTN} bg-brand text-content-inverse hover:opacity-90`;
export const BTN_GREEN = `${BTN} bg-brand-green text-brand hover:brightness-95`;
export const BTN_GHOST = `${BTN} border border-line bg-surface-white text-content-muted hover:bg-surface-muted hover:text-content`;
export const BTN_DANGER = `${BTN} bg-rose-600 text-white hover:bg-rose-700`;
export const BTN_DANGER_SOFT = `${BTN} border border-rose-200 bg-surface-white text-rose-700 hover:bg-rose-50`;

export const TONE_BUTTON = {
  green: BTN_GREEN,
  danger: BTN_DANGER,
  navy: BTN_NAVY,
};