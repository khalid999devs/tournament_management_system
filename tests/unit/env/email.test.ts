import { afterEach, describe, expect, it, vi } from "vitest";
import { getEmailEnv } from "@/lib/env/server";

describe("getEmailEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts Gmail SMTP credentials and strips App Password spaces", () => {
    vi.stubEnv("SMTP_USER", "ndcak@example.com");
    vi.stubEnv("SMTP_PASSWORD", "abcd efgh ijkl mnop");
    vi.stubEnv("EMAIL_REPLY_TO", "ndcak@example.com");

    expect(getEmailEnv()).toEqual({
      SMTP_HOST: "smtp.gmail.com",
      SMTP_PORT: 465,
      SMTP_USER: "ndcak@example.com",
      SMTP_PASSWORD: "abcdefghijklmnop",
      EMAIL_FROM_NAME: "NDCAK Indoor Games",
      EMAIL_REPLY_TO: "ndcak@example.com",
    });
  });

  it("rejects incomplete SMTP configuration", () => {
    vi.stubEnv("SMTP_USER", "not-an-email");
    vi.stubEnv("EMAIL_REPLY_TO", "admin@example.com");

    expect(() => getEmailEnv()).toThrow("Invalid email environment");
  });
});
