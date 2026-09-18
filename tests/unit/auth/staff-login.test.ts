import { describe, expect, it } from "vitest";
import { staffLoginSchema } from "@/features/auth/domain/staff-login";

describe("staffLoginSchema", () => {
  it("accepts a valid staff credential shape", () => {
    const result = staffLoginSchema.safeParse({
      email: "admin@example.com",
      password: "secure-password",
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed or short credentials", () => {
    const result = staffLoginSchema.safeParse({
      email: "not-an-email",
      password: "short",
    });

    expect(result.success).toBe(false);
  });
});
