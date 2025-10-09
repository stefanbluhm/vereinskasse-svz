export function fmtEUR(v = 0) {
  const n = Number(v) || 0;
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}
