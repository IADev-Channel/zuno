import { readFile, writeFile } from "node:fs/promises";
import { aggregateReports, evaluateSlo, validateProfile } from "./lib.mjs";

const argument = (name) => {
	const index = process.argv.indexOf(`--${name}`);
	return index === -1 ? undefined : process.argv[index + 1];
};
const profilePath = argument("profile");
const reportPaths = process.argv.slice(process.argv.indexOf("--reports") + 1);
if (
	!profilePath ||
	!process.argv.includes("--reports") ||
	reportPaths.length === 0
)
	throw new Error(
		"usage: --profile <path> [--output <path>] --reports <files...>",
	);
const outputIndex = reportPaths.indexOf("--output");
const output = outputIndex === -1 ? undefined : reportPaths[outputIndex + 1];
const paths =
	outputIndex === -1 ? reportPaths : reportPaths.slice(0, outputIndex);
const profile = validateProfile(
	JSON.parse(await readFile(profilePath, "utf8")),
);
const reports = await Promise.all(
	paths.map(async (path) => JSON.parse(await readFile(path, "utf8"))),
);
const summary = aggregateReports(reports, profile);
const result = { ...summary, slo: evaluateSlo(summary, profile) };
const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (output) await writeFile(output, serialized);
else console.log(serialized);
if (!result.slo.pass) process.exitCode = 1;
