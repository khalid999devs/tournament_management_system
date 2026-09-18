export function normalizeStudentId(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizeTransactionId(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizeBangladeshPhone(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    return `+${digits}`;
  }

  if (digits.startsWith("01")) {
    return `+88${digits}`;
  }

  return value.trim();
}
