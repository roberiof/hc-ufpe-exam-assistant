import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } },
  test: { include: ["evaluation/run.test.ts"], testTimeout: 120_000 },
})
