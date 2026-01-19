import { assertSafeProductionEnv } from "../src/lib/envGuards";

describe("assertSafeProductionEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when ALLOW_DEV_AUTH_BYPASS is true in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_AUTH_BYPASS = "true";

    expect(() => assertSafeProductionEnv()).toThrow(
      /ALLOW_DEV_AUTH_BYPASS/
    );
  });

  it("throws when AI_CALLBACK_SIMULATION is true in production", () => {
    process.env.NODE_ENV = "production";
    process.env.AI_CALLBACK_SIMULATION = "true";

    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_AUTH_BYPASS = "false";
    process.env.AI_CALLBACK_SIMULATION = "true";

    expect(() => assertSafeProductionEnv()).toThrow(
      /AI_CALLBACK_SIMULATION/
    );
  });

  it("throws when DATABASE_URL indicates sqlite in production", () => {
    process.env.NODE_ENV = "production";
    process.env.ALLOW_DEV_AUTH_BYPASS = "false";
    process.env.AI_CALLBACK_SIMULATION = "false";
    process.env.DATABASE_URL = "file:./dev.db";

    expect(() => assertSafeProductionEnv()).toThrow(/SQLite/);
  });

  it("does not throw outside production", () => {
    process.env.NODE_ENV = "test";
    process.env.ALLOW_DEV_AUTH_BYPASS = "true";
    process.env.AI_CALLBACK_SIMULATION = "true";
    process.env.DATABASE_URL = "file:./dev.db";

    expect(() => assertSafeProductionEnv()).not.toThrow();
  });
});
