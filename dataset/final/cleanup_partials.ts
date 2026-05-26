import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

const run = async () => {
  const testedPath = join(__dirname, 'tested_dataset.json');
  const partialDir = join(__dirname, 'evaluation', 'partial');

  const testedContent = await readFile(testedPath, 'utf8');
  const testedDataset = JSON.parse(testedContent);
  const validIds = new Set(testedDataset.map((item: any) => item.id));

  console.log(`Loaded ${validIds.size} valid IDs from tested_dataset.json`);

  async function findJsonFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await findJsonFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const partialFiles = await findJsonFiles(partialDir);
  console.log(`Found ${partialFiles.length} partial files`);

  let deletedFiles = 0;
  let modifiedFiles = 0;
  let removedSamples = 0;

  for (const filePath of partialFiles) {
    const content = await readFile(filePath, 'utf8');
    const data = JSON.parse(content);

    if (!Array.isArray(data.samples)) {
      console.log(`Skipping ${filePath} (no samples array)`);
      continue;
    }

    const originalCount = data.samples.length;
    const filteredSamples = data.samples.filter((sample: any) => validIds.has(sample.id));
    const removedCount = originalCount - filteredSamples.length;

    if (removedCount > 0) {
      if (filteredSamples.length === 0) {
        await unlink(filePath);
        deletedFiles++;
        console.log(`Deleted ${filePath} (all ${originalCount} samples had invalid IDs)`);
      } else {
        data.samples = filteredSamples;
        data.completed_samples = filteredSamples.length;
        await writeFile(filePath, JSON.stringify(data, null, 2));
        modifiedFiles++;
        console.log(`Modified ${filePath}: removed ${removedCount} samples, kept ${filteredSamples.length}`);
      }
      removedSamples += removedCount;
    } else {
      console.log(`Kept ${filePath} (all ${originalCount} samples valid)`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`- Deleted files: ${deletedFiles}`);
  console.log(`- Modified files: ${modifiedFiles}`);
  console.log(`- Removed samples: ${removedSamples}`);
};

run().catch(console.error);
