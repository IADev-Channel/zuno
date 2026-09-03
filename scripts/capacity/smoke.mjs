import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "zuno-capacity-"));
const report = join(directory, "shard-0.json");
const summary = join(directory, "summary.json");
const run = (args) => {
	const result = spawnSync(process.execPath, args, {
		cwd: process.cwd(),
		encoding: "utf8",
	});
	if (result.status !== 0)
		throw new Error(
			result.stderr || result.stdout || "capacity command failed",
		);
};
try {
	run([
		"scripts/capacity/run.mjs",
		"--profile",
		"benchmarks/profiles/smoke.json",
		"--shard-index",
		"0",
		"--shard-count",
		"1",
		"--output",
		report,
	]);
	run([
		"scripts/capacity/aggregate.mjs",
		"--profile",
		"benchmarks/profiles/smoke.json",
		"--reports",
		report,
		"--output",
		summary,
	]);
	console.log(await readFile(summary, "utf8"));
} finally {
	await rm(directory, { recursive: true, force: true });
}
