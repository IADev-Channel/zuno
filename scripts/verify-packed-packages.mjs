import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const runtime = process.argv[2] === "bun" ? "bun" : "npm";
const packageDirectories = [
	"zuno",
	"zuno-react",
	"zuno-angular",
	"zuno-express",
	"zuno-elysia",
];
const temporaryRoot = await mkdtemp(join(tmpdir(), "zuno-packages-"));
const tarballDirectory = join(temporaryRoot, "tarballs");

try {
	await mkdir(tarballDirectory);

	for (const directory of packageDirectories) {
		await exec("pnpm", ["pack", "--pack-destination", tarballDirectory], {
			cwd: join(root, "packages", directory),
		});
	}

	const tarballs = (await readdir(tarballDirectory))
		.filter((file) => file.endsWith(".tgz"))
		.map((file) => join(tarballDirectory, file));

	if (tarballs.length !== packageDirectories.length) {
		throw new Error(
			`Expected ${packageDirectories.length} tarballs, found ${tarballs.length}`,
		);
	}

	for (const fixture of ["esm", "commonjs"]) {
		const fixtureDirectory = join(temporaryRoot, fixture);
		await cp(join(root, "fixtures", fixture), fixtureDirectory, {
			recursive: true,
		});
		await exec(
			"npm",
			["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs],
			{ cwd: fixtureDirectory },
		);
		const testCommand = runtime === "bun" ? ["run", "index.js"] : ["test"];
		if (runtime === "bun" && fixture === "commonjs") {
			testCommand[1] = "index.cjs";
		}
		const { stdout } = await exec(runtime, testCommand, {
			cwd: fixtureDirectory,
		});
		process.stdout.write(stdout);
	}
} finally {
	await rm(temporaryRoot, { recursive: true, force: true });
}
