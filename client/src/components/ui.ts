// Shared Tailwind class strings for consistent Light & Dark Mode UI/UX across all modules.
// Strictly compliant with DESIGN_CONSTITUTION.md & better-ui standards.

export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 dark:hover:bg-emerald-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-transform duration-100 ease-out cursor-pointer';

export const btnSecondary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-transform duration-100 ease-out cursor-pointer';

export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 dark:bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-rose-700 dark:hover:bg-rose-500 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-transform duration-100 ease-out cursor-pointer';

export const btnSmall =
  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700 active:scale-[0.98] transition-transform duration-100 ease-out disabled:opacity-50 cursor-pointer';

export const btnSmallPrimary =
  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/80 active:scale-[0.98] transition-transform duration-100 ease-out disabled:opacity-50 cursor-pointer';

export const btnSmallDanger =
  'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 active:scale-[0.98] transition-transform duration-100 ease-out disabled:opacity-50 cursor-pointer';

export const inputClass =
  'block w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-600 dark:focus:ring-emerald-500';

export const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300';

export const cardClass = 'rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs';

// Strict Sticky Table Header Configuration
export const tableContainerClass =
  'relative max-h-[620px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs';

export const tableHeadClass =
  'sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs text-left text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 shadow-xs';

export const thClass = 'px-4 py-3';
export const thStickyClass =
  'sticky top-0 z-20 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 shadow-xs';
export const tdClass = 'px-4 py-3 text-sm text-slate-700 dark:text-slate-300';
