import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["cjs", "esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	external: ["@angular/core", "rxjs", "@iadev93/zuno"],
});
