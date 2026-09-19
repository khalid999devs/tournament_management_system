import type { AnyScoringAdapter } from "../adapters";

// Turns the admin form's `config.<name>` fields into input for the adapter's
// config schema, which then validates and fills defaults.
export function configFromForm(
  adapter: AnyScoringAdapter,
  read: (name: string) => FormDataEntryValue | null,
) {
  const config: Record<string, unknown> = {};
  for (const field of adapter.configFields) {
    const raw = read(field.name);
    const value = typeof raw === "string" ? raw.trim() : "";
    switch (field.kind) {
      case "boolean":
        config[field.name] = value === "on" || value === "true";
        break;
      case "number":
        config[field.name] =
          value === "" ? (field.optional ? null : undefined) : Number(value);
        break;
      case "select":
        config[field.name] =
          value === "true" ? true : value === "false" ? false : value;
        break;
      case "text":
        config[field.name] = value;
        break;
      case "numberList":
        config[field.name] = value
          .split(/[\s,]+/)
          .filter(Boolean)
          .map(Number);
        break;
    }
  }
  return config;
}

// The inverse, for pre-filling the form.
export function configFieldValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
