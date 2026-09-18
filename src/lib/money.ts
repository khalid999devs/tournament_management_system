const bdtFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 0,
});

export function formatBdt(minorAmount: number) {
  return bdtFormatter.format(minorAmount / 100);
}
