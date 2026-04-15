import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

type FinalOutput = {
  id: number;
  task: string;
  question: string;
  options: string[];
  answer: number;
  rationale: string | null;
};

const run = async () => {
  const dataPath = join(__dirname, 'dataset.json');
  const rejectedPath = join(__dirname, 'dataset_rejected.json');

  const content = await readFile(dataPath, 'utf8');
  const dataset: FinalOutput[] = JSON.parse(content);

  let rejectedCount = 0;
  try {
    const rejectedContent = await readFile(rejectedPath, 'utf8');
    const rejectedDataset = JSON.parse(rejectedContent);
    rejectedCount = rejectedDataset.length;
  } catch (e) {
    // File might not exist
  }

  const taskCounts: Record<string, number> = {};
  const optionCounts: Record<number, number> = {};
  let nullRationaleCount = 0;

  for (const item of dataset) {
    // Count tasks
    taskCounts[item.task] = (taskCounts[item.task] || 0) + 1;

    // Count option lengths
    optionCounts[item.options.length] = (optionCounts[item.options.length] || 0) + 1;

    // Count null rationales
    if (item.rationale === null) {
      nullRationaleCount++;
    }
  }

  console.log('='.repeat(50));
  console.log(' DATASET SUMMARY REPORT ');
  console.log('='.repeat(50));
  console.log(`Total valid items: ${dataset.length}`);
  console.log(`Total rejected items: ${rejectedCount}`);
  console.log(`\nItems with missing/null rationales: ${nullRationaleCount} (${((nullRationaleCount / dataset.length) * 100).toFixed(2)}%)`);

  console.log('\n== Task Breakdown');
  const sortedTasks = Object.entries(taskCounts).sort((a, b) => b[1] - a[1]);
  for (const [task, count] of sortedTasks) {
    console.log(`- ${task}: ${count} (${((count / dataset.length) * 100).toFixed(2)}%)`);
  }

  console.log('\n== Options Length Breakdown');
  const sortedOptions = Object.entries(optionCounts).sort((a, b) => Number(a[0]) - Number(b[0]));
  for (const [length, count] of sortedOptions) {
    console.log(`- ${length} options: ${count} (${((count / dataset.length) * 100).toFixed(2)}%)`);
  }

  console.log('='.repeat(50));
};

run().catch(console.error);
