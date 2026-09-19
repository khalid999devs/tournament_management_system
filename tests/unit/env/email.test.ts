import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEmailEnv } from "@/lib/env/server";

describe("getEmailEnv", () => {
  beforeEach(() => {
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASSWORD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses Gmail SMTP when SMTP credentials are set", () => {
    vi.stubEnv("SMTP_USER", "ndcak@example.com");
    vi.stubEnv("SMTP_PASSWORD", "abcd efgh ijkl mnop");
    vi.stubEnv("EMAIL_REPLY_TO", "ndcak@example.com");

    expect(getEmailEnv()).toEqual({
      transport: "smtp",
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

  it("falls back to Resend when no SMTP credentials are set", () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_12345678901234567890");
    vi.stubEnv("EMAIL_FROM", "NDCAK <events@example.com>");
    vi.stubEnv("EMAIL_REPLY_TO", "admin@example.com");

    expect(getEmailEnv()).toEqual({
      transport: "resend",
      RESEND_API_KEY: "re_test_12345678901234567890",
      EMAIL_FROM: "NDCAK <events@example.com>",
      EMAIL_REPLY_TO: "admin@example.com",
    });
  });

  it("rejects malformed Resend configuration", () => {
    vi.stubEnv("RESEND_API_KEY", "invalid");
    vi.stubEnv("EMAIL_FROM", "");
    vi.stubEnv("EMAIL_REPLY_TO", "not-an-email");

    expect(() => getEmailEnv()).toThrow("Invalid email environment");
  });
});
