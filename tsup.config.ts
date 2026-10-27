import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts", "src/collect.ts"],
  format: ["esm", "cjs"],
  target: "node18",
  clean: true,
  sourcemap: false,
  splitting: false,
});
