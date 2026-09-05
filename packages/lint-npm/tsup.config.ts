import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/bin.ts", "src/install.ts"],
  format: ["esm"],
  dts: { entry: ["src/index.ts"] },
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
