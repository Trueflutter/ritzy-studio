import "dotenv/config";

import { formatEnvError, parseServerEnv } from "@ritzy-studio/config";

try {
  parseServerEnv(process.env);
  console.log("Environment validation passed.");
} catch (error) {
  console.error("Environment validation failed:");
  console.error(formatEnvError(error));
  process.exit(1);
}
