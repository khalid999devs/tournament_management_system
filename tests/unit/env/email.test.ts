import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailEnv } from "@/lib/env/server";

describe("getEmailEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a complete server-side email configuration", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_12345678901234567890");
    vi.stubEnv("EMAIL_FROM", "NDCAK <events@example.com>");
    vi.stubEnv("EMAIL_REPLY_TO", "admin@example.com");

    expect(getEmailEnv()).toEqual({
      RESEND_API_KEY: "re_test_12345678901234567890",
      EMAIL_FROM: "NDCAK <events@example.com>",
      EMAIL_REPLY_TO: "admin@example.com",
    });
  });

  it("rejects malformed email configuration", () => {
    vi.stubEnv("RESEND_API_KEY", "invalid");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("EMAIL_REPLY_TO", "not-an-email");

    expect(() => getEmailEnv()).toThrow("Invalid email environment");
  });
});
