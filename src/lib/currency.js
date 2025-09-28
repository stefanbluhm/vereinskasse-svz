export const fmtEUR = (n) =>
  (Number.isFinite(+n) ? +n : 0).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
