import { beforeEach } from "@jest/globals";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

import { resetDb } from "./helpers/resetDb";

beforeEach(async () => {
  await resetDb();
});
