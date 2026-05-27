import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { exit } from "process";

const ANALYSIS_DIR = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1") +
  "evaluation/partial/analysis/";

interface Result {
  sample_id: number;
  task: string;
  expected: number;
  predicted: number | null;
  correct: boolean;
  raw_response: string;
  latency_ms: number;
  batch_id: number;
  timestamp: string;
  logprobs?: unknown;
}

interface AnalysisFile {
  model: string;
  provider: string;
  dataset_file: string;
  started_at: string;
  last_updated: string;
  total_samples: number;
  completed_samples: number;
  results: Result[];
}

function isParseable(raw: string): boolean {
  try {
    const data = JSON.parse(raw.trim());
    if (typeof data === "object" && data !== null && "answers" in data) {
      const answers = (data as { answers: unknown }).answers;
      if (Array.isArray(answers) && answers.length > 0) return true;
    }
    if (typeof data === "object" && data !== null && "answer" in data) return true;
    if (Array.isArray(data) && data.length > 0) return true;
    return false;
  } catch {
    return false;
  }
}

async function cleanFile(filePath: string): Promise<{ removed: number; alreadyOk: number }> {
  const raw = await readFile(filePath, "utf-8");
  const data: AnalysisFile = JSON.parse(raw);

  const before = data.results.length;
  data.results = data.results.filter((r) => {
    if (r.predicted !== null) return true;
    return isParseable(r.raw_response);
  });
  const removed = before - data.results.length;
  data.completed_samples = data.results.filter((r) => r.predicted !== null).length;

  if (removed > 0) {
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`  Removed ${removed} unparseable entries (${before} → ${data.results.length})`);
  } else {
    console.log(`  No unparseable entries to remove`);
  }
  return { removed, alreadyOk: data.completed_samples };
}

async function main() {
  const files = (await readdir(ANALYSIS_DIR)).filter((f) => f.endsWith(".json.json") || f.endsWith(".json"));
  let totalRemoved = 0;

  for (const file of files) {
    const filePath = join(ANALYSIS_DIR, file);
    console.log(`Processing: ${file}`);
    try {
      const { removed } = await cleanFile(filePath);
      totalRemoved += removed;
    } catch (err) {
      console.error(`  ❌ Error: ${err}`);
    }
  }

  console.log(`\nTotal removed: ${totalRemoved}`);
}

main();