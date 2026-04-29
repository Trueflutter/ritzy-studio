import "dotenv/config";

import { formatEnvError, parseServerEnv } from "@ritzy-studio/config";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), "../../.env.local") });

try {
  parseServerEnv(process.env);
  console.log("Environment validation passed.");
} catch (error) {
  console.error("Environment validation failed:");
  console.error(formatEnvError(error));
  process.exit(1);
}
