/** Download rows as a CSV file in the browser. */
export function toCsvDownload(rows: Record<string, unknown>[], filename: string) {
  if (!rows?.length) return;
  const cols = Object.keys(rows[0]!).filter((k) => typeof rows[0]![k] !== 'object');
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
