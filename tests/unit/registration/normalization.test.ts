import { describe, expect, it } from "vitest";
import {
  normalizeBangladeshPhone,
  normalizeStudentId,
  normalizeTransactionId,
} from "@/features/registration/domain/normalization";

describe("registration normalization", () => {
  it("normalizes student and payment references", () => {
    expect(normalizeStudentId("  2107  001 ")).toBe("2107001");
    expect(normalizeTransactionId("  trx ab 19 ")).toBe("TRXAB19");
  });

  it("normalizes common Bangladesh phone formats", () => {
    expect(normalizeBangladeshPhone("01712-345678")).toBe("+8801712345678");
    expect(normalizeBangladeshPhone("8801712345678")).toBe("+8801712345678");
  });
});
