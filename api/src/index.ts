// api/src/index.ts

import "dotenv/config";   // <-- MUST be first: loads .env for dev, test, prod
import "./server";        // boots the app after env is guaranteed
