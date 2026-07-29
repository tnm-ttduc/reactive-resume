import type { Template } from "@reactive-resume/schema/templates";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createResumePdfFile } from "@reactive-resume/pdf/server";
import { resumeDataSchema } from "@reactive-resume/schema/resume/data";
import { templateSchema } from "@reactive-resume/schema/templates";
import { createGoldenDatasets } from "./resume-fixtures";

// The application bundler injects the classic JSX runtime for package TSX. The standalone
// Sprint 0 harness runs source files directly, so expose React in the same way before rendering.
Object.assign(globalThis, { React });

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outputRoot = resolve(repositoryRoot, "tmp/pdfs/golden");
const templates = templateSchema.options;
const datasets = createGoldenDatasets();
const results: Array<{ dataset: string; template: Template; bytes: number; path: string }> = [];

for (const [datasetName, sourceData] of Object.entries(datasets)) {
	const validation = resumeDataSchema.safeParse(sourceData);
	if (!validation.success) throw new Error(`Invalid golden dataset ${datasetName}: ${validation.error.message}`);

	const datasetDirectory = resolve(outputRoot, datasetName);
	await mkdir(datasetDirectory, { recursive: true });

	for (const template of templates) {
		const data = structuredClone(validation.data);
		data.metadata.template = template;
		const outputPath = resolve(datasetDirectory, `${template}.pdf`);
		const file = await createResumePdfFile({ data, template, filename: `${datasetName}-${template}.pdf` });
		const bytes = new Uint8Array(await file.arrayBuffer());

		if (bytes.byteLength < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
			throw new Error(`Invalid PDF generated for ${datasetName}/${template}`);
		}

		await writeFile(outputPath, bytes);
		results.push({ dataset: datasetName, template, bytes: bytes.byteLength, path: outputPath });
	}
}

await writeFile(resolve(outputRoot, "manifest.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(
	`Rendered ${results.length} PDFs across ${Object.keys(datasets).length} datasets and ${templates.length} templates.`,
);
