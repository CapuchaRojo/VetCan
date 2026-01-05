// tests/setup.ts

import { beforeEach } from "@jest/globals";

// 1️⃣ Load test env FIRST
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

// 2️⃣ Force Prisma to use the test schema
process.env.NODE_ENV = "test";
process.env.PRISMA_SCHEMA_PATH = "prisma/schema.test.prisma";

// 3️⃣ Import helpers AFTER env is set
import { resetDb } from "./helpers/resetDb";

// 4️⃣ Reset DB before each test
beforeEach(async () => {
  await resetDb();
});
