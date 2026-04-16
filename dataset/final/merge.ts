import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type FinalOutput = {
  id: number;
  task: string;
  question: string;
  options: string[];
  answer: number;
  rationale: string | null;
};

type InterimOutput = Omit<FinalOutput, 'id'> & { source: string };

// Source 1 types
type S1Exercise = {
  task_type: string;
  title: string;
  statement: string;
  alternatives: string[];
  solution: { description: string; index: number };
};

// Source 2 types
type S2Alternative = {
  code: string;
  content: string;
};
type S2Question = {
  task: string;
  questionContent: string;
  alternatives: S2Alternative[];
  explanation: string;
  answer: string;
};

// Source 3 types
type S3Alternative = string;
type S3QuestionNode = {
  alternatives: S3Alternative[];
  correct: number;
  rationale: string;
  statement: string;
};
type S3Node = {
  type: string;
  statement?: string;
  alternatives?: S3Alternative[];
  correct?: number;
  rationale?: string;
  questions?: S3QuestionNode[];
};

const cleanOptions = (options: string[] | undefined): string[] => {
  if (!Array.isArray(options)) return [];
  return options.map(opt => {
    // Replace prefixes like "A) ", "b. ", "1) "
    if (typeof opt !== 'string') return String(opt);
    return opt.replace(/^\s*([a-zA-Z]|\d+)\s*[.)]\s*/, '').trim();
  });
};

const processSource1 = async (): Promise<InterimOutput[]> => {
  const content = await readFile(join(__dirname, '../source_1/output.json'), 'utf8');
  const data: S1Exercise[] = JSON.parse(content);

  return data.map((item) => {
    let options = cleanOptions(item.alternatives);
    // Handle case where options are lumped into a single string separated by spaces/tabs
    // It could be 1 string or multiple strings that still contain other options
    let newOptions: string[] = [];
    for (let opt of options) {
      if (opt.match(/[a-eA-E]\)/)) {
         let splitOpts = opt.split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
         if (splitOpts.length !== 5 && splitOpts.length !== 4) {
             splitOpts = opt.split(/\s*[a-eA-E][\.\)]\s*/).filter(o => o.trim() !== '');
         }

         // Final fallback for lumped strings
         if (splitOpts.length === 1 && splitOpts[0].length > 10) {
              const regex = /\s*[a-eA-E][\.\)]\s*|\s+[a-eA-E]\s+/g;
              splitOpts = opt.split(regex).filter(o => o.trim());
         }

         // Final final fallback if there's weird tabs and spaces inside options like: IV         c) II         d) V          e) III
         if (splitOpts.some(o => o.match(/[a-eA-E]\)/))) {
              let deepSplit: string[] = [];
              for (const part of splitOpts) {
                  const pieces = part.split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim());
                  deepSplit.push(...pieces);
              }
              splitOpts = deepSplit;
         }

         if (splitOpts.length >= 4) {
             newOptions.push(...splitOpts.map(o => o.replace(/\s+/g, ' ').trim()));
         } else if (opt.includes('IV') || opt.includes('V') || opt.includes('III')) {
             newOptions.push(opt.trim()); // Likely a single I - II - III option instead of a lumped string
         } else {
             // Fallback string matching for when it splits poorly due to spaces or missing characters
             if (opt.match(/[a-eA-E]\)/) && opt.length > 3) {
                 const pieces = opt.split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim());
                 newOptions.push(...pieces);
             } else {
                 newOptions.push(opt.trim());
             }
         }

         // Final fallback for lumped strings
         if (splitOpts.length === 1 && splitOpts[0].length > 10) {
              const regex = /\s*[a-eA-E][\.\)]\s*|\s+[a-eA-E]\s+/g;
              splitOpts = opt.split(regex).filter(o => o.trim());
         }

         // Final final fallback if there's weird tabs and spaces inside options like: IV         c) II         d) V          e) III
         if (splitOpts.some(o => o.match(/[a-eA-E]\)/))) {
              let deepSplit: string[] = [];
              for (const part of splitOpts) {
                  const pieces = part.split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim());
                  deepSplit.push(...pieces);
              }
              splitOpts = deepSplit;
         }

         if (splitOpts.length === 5) {
             newOptions.push(...splitOpts.map(o => o.replace(/\s+/g, ' ').trim()));
         } else if (opt.includes('IV') || opt.includes('V') || opt.includes('III')) {
             newOptions.push(opt.trim()); // Likely a single I - II - III option instead of a lumped string
         } else {
             // Fallback string matching for when it splits poorly due to spaces or missing characters
             if (opt.match(/[a-eA-E]\)/) && opt.length > 3) {
                 const pieces = opt.split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim());
                 if (pieces.length === 5) {
                     newOptions.push(...pieces);
                 } else {
                     let deepSplit: string[] = [];
                     pieces.forEach(p => deepSplit.push(...p.split(/\s*[a-eA-E][\.\)]\s*/).filter(Boolean)));
                     newOptions.push(...deepSplit);
                 }
             } else {
                 newOptions.push(opt.trim());
             }
         }
         if (splitOpts.length === 5) {
             newOptions.push(...splitOpts.map(o => o.replace(/\s+/g, ' ').trim()));
         } else if (opt.includes('IV') || opt.includes('V') || opt.includes('III')) {
                 newOptions.push(opt.trim()); // Likely a single I - II - III option instead of a lumped string
         } else {
             // Fallback string matching for when it splits poorly due to spaces or missing characters
             if (opt.match(/[a-eA-E]\)/) && opt.length > 3) {
                 const pieces = opt.split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim());
                 newOptions.push(...pieces);
             } else {
                 newOptions.push(opt.trim());
             }
         }
      } else if (opt.includes('II') && (opt.includes('III') || opt.includes('IV') || opt.includes('V'))) {
         // handle cases like I   II   III
         if (opt.match(/\b(I|II|III|IV|V)\b/g)) {
             newOptions.push(opt); // Usually this means it's a "I, II, III" type sequence option, let's keep it intact if it doesn't have a) b)
         } else {
             newOptions.push(opt);
         }
      } else {
         newOptions.push(opt);
      }
    }
    options = newOptions;

    // Additional cleaning for edge cases like "c \n ) III"
    options = options.filter(o => o.trim() !== 'c' && o.trim() !== ')' && !o.includes('Solución:'));
    let cleanOpts: string[] = [];
    for (let opt of options) {
        if (opt.startsWith(') ')) opt = opt.substring(2);
        if (opt.trim().length > 0) cleanOpts.push(opt.trim());
    }
    options = cleanOpts;

    // Deduplicate
    options = [...new Set(options)];

    return {
      task: item.task_type,
      question: `${item.title}\n${item.statement}`.trim(),
      options: options.filter(o => !o.includes('Solución:') && !o.includes('Rpta.')).slice(0, 5),
      answer: item.solution.index,
      rationale: item.solution.description?.trim() || null,
    };
  });
};

const processSource2 = async (): Promise<InterimOutput[]> => {
  const content = await readFile(join(__dirname, '../source_2/output.json'), 'utf8');
  const data: S2Question[] = JSON.parse(content);

  return data.map((item) => {
    // Answer is typically A, B, C, D, E. Map to 0-4
    const ansCode = item.answer.trim().toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
    return {
      source: 'source_2',
      task: item.task,
      question: item.questionContent,
      // Source 2 already parsed them into objects with code and content
      options: item.alternatives.map(a => a.content.replace(/^[^a-zA-Z0-9]+/, '').trim()),
      answer: ansCode,
      rationale: item.explanation?.trim() || null,
    };
  });
};

const processSource3 = async (): Promise<InterimOutput[]> => {
  const datasetDir = join(__dirname, '../source_3/output/dataset');
  const results: InterimOutput[] = [];

  async function exploreDir(dirPath: string) {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await exploreDir(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.json')) {
        const content = await readFile(fullPath, 'utf8');
        try {
          const data: S3Node[] = JSON.parse(content);
          // Some files are array of nodes, some are single node
          const nodes = Array.isArray(data) ? data : [data];

          for (const node of nodes) {
            if (node.questions && node.questions.length > 0) {
              // It's a reading comprehension (or similar) with nested questions
              for (const q of node.questions) {
              let options = cleanOptions(q.alternatives);
              if (options.length === 1 && options[0].includes(',')) {
                  // Only split if it doesn't look like a long sentence
                  if (options[0].split(',').length === 5 || options[0].length < 30) {
                      options = options[0].split(',').map(o => o.trim()).filter(o => o);
                  }
              }
              // Try splitting by a), b), c) if lumped together
              if (options.length === 1 && typeof options[0] === 'string' && options[0].match(/[b-eB-E]\)/)) {
                  let splitOpts = options[0].split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
                  // Sometimes a) b) etc are in the middle and it matched the front too, try again with strict
                  if (splitOpts.length !== 5) {
                      splitOpts = options[0].split(/\s*[a-eA-E][\.\)]\s*/).filter(o => o.trim() !== '');
                  }
                  options = splitOpts.map(o => o.replace(/\s+/g, ' ').trim());
              }
              if (options.length > 0 && options[0].includes('(') && options[0].includes(')')) {
                 const splitOpts = options[0].split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
                 if (splitOpts.length === 5) {
                     options = splitOpts.map(o => o.replace(/\s+/g, ' ').trim());
                 }
              }

              // Handle source 3 weird options split
              if (options.length > 5) {
                 // Try to stitch them back together if they look like broken sentences
                 let backup = cleanOptions(q.alternatives);
                 if (backup.length === options.length) {
                     if (backup.length === 8 || backup.length === 10 || backup.length === 6 || backup.length === 7 || backup.length === 9 || backup.length === 12) {
                         let stitched = [];
                         let current = "";
                         for (let i = 0; i < backup.length; i++) {
                             // Check if the next item starts with lowercase and we don't end with a punctuation
                             if (i + 1 < backup.length && backup[i+1] && backup[i+1].match(/^[a-z]/) && backup[i] && !backup[i].match(/[.?!]$/)) {
                                 current = (backup[i] + ' ' + backup[i+1]).trim();
                                 i++; // Skip the next one
                             } else if (i + 1 < backup.length && backup[i+1] && (backup[i+1].startsWith('de ') || backup[i+1].startsWith('con ') || backup[i+1].startsWith('del ') || backup[i+1].startsWith('y '))) {
                                 current = (backup[i] + ' ' + backup[i+1]).trim();
                                 i++;
                             } else if (backup[i]?.match(/^[ivxIVX]+(?:\s*-\s*[ivxIVX]+)*$/) && i + 1 < backup.length && backup[i+1]?.trim() === "") {
                                 // Handle case: "iv - iii - ii - i - v", ""
                                 current = backup[i].trim();
                                 i++;
                             } else {
                                 current = backup[i]?.trim() || "";
                             }

                             // If it's a blank string due to a weird split, just continue accumulating
                             if (current === "" && i + 1 < backup.length) {
                                 current = backup[i+1].trim();
                                 i++;
                             }

                             if (current) stitched.push(current);
                         }
                         if (stitched.length === 5 || stitched.length === 4 || stitched.length === 3) {
                             options = stitched;
                         } else {
                             // Let's filter out known junk evaluation letters from the options array that shouldn't be there
                             const filtered = stitched.filter(o => !o.match(/^[CIVF]+$/i));
                             if (filtered.length === 5 || filtered.length === 4 || filtered.length === 3) {
                                 options = filtered;
                             } else if (backup.length === 6 || backup.length === 8 || backup.length === 10 || backup.length === 12) {
                                 // Fallback to strict pairing
                                 stitched = [];
                                 for (let j = 0; j < backup.length; j += 2) {
                                     if (j + 1 < backup.length) {
                                         stitched.push((backup[j] + ' ' + backup[j+1]).trim());
                                     } else {
                                         stitched.push(backup[j].trim());
                                     }
                                 }
                                 if (stitched.length === 5 || stitched.length === 4 || stitched.length === 3) {
                                     options = stitched;
                                 }
                             }
                         }
                     }
                 }
              }

              if (options.length > 0 && typeof options[0] === 'string') {
                  if (options.some(o => o.trim() === 'y el este (Asi' || o.trim() === 'y el este (Asi)') || options.length > 5 || options.some(o => o.trim() === 'muerte de estas.' || o.trim() === 'con menores recursos.' || o.trim() === 'C' || o.trim() === 'I' || o.includes('muerte de estas.'))) {
                      // It was bad split, let's revert to original node options
                      let backup = cleanOptions(q.alternatives);
                      if (backup.length > 0 && backup[0].includes('(') && backup[0].includes(')')) {
                         const splitOpts = backup[0].split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
                         if (splitOpts.length === 5) {
                             backup = splitOpts.map(o => o.replace(/\s+/g, ' ').trim());
                         }
                      }
                      options = backup;
                  }
              }

              let questionText = `${node.statement || ''}\n\n${q.statement || ''}`.trim();
              let rationaleText = q.rationale || '';

              if (!rationaleText) {
                  // Catch exact pattern like "Solución:\nI – I – C – I – C – I – I – C – C – I" at the end of the text
                  const match = questionText.match(/\n\s*(Solución|Resolución|Respuesta|Clave)[\s:.]+([\s\S]*)$/i);
                  if (match && match.index !== undefined) {
                      rationaleText = match[0].trim();
                      questionText = questionText.substring(0, match.index).trim();
                  }
              }

              let mappedTask = node.type;
              if (mappedTask === 'writing_plan') {
                  mappedTask = 'sentence_ordering';
              }

               results.push({
                source: 'source_3',
                task: mappedTask,
                question: questionText,
                options: options,
                answer: q.correct,
                rationale: rationaleText?.trim() || null,
              });
              }
            } else if (node.alternatives && node.statement) {
              // Flat question
              let options = cleanOptions(node.alternatives);
              if (options.length === 1 && options[0].includes(',')) {
                  if (options[0].split(',').length === 5 || options[0].length < 30) {
                      options = options[0].split(',').map(o => o.trim()).filter(o => o);
                  }
              }
              // Try splitting by a), b), c) if lumped together
              if (options.length === 1 && typeof options[0] === 'string' && options[0].match(/[b-eB-E]\)/)) {
                  let splitOpts = options[0].split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
                  // Sometimes a) b) etc are in the middle and it matched the front too, try again with strict
                  if (splitOpts.length !== 5) {
                      splitOpts = options[0].split(/\s*[a-eA-E][\.\)]\s*/).filter(o => o.trim() !== '');
                  }
                  options = splitOpts.map(o => o.replace(/\s+/g, ' ').trim());
              }
              if (options.length > 0 && options[0].includes('(') && options[0].includes(')')) {
                 const splitOpts = options[0].split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
                 if (splitOpts.length === 5) {
                     options = splitOpts.map(o => o.replace(/\s+/g, ' ').trim());
                 }
              }

              if (options.length > 5) {
                 // Try to stitch them back together if they look like broken sentences
                 let backup = cleanOptions(node.alternatives);
                 if (backup.length === options.length) {
                     if (backup.length === 8 || backup.length === 10 || backup.length === 6 || backup.length === 7 || backup.length === 9 || backup.length === 12) {
                         let stitched = [];
                         let current = "";
                         for (let i = 0; i < backup.length; i++) {
                             // Check if the next item starts with lowercase and we don't end with a punctuation
                             if (i + 1 < backup.length && backup[i+1] && backup[i+1].match(/^[a-z]/) && backup[i] && !backup[i].match(/[.?!]$/)) {
                                 current = (backup[i] + ' ' + backup[i+1]).trim();
                                 i++; // Skip the next one
                             } else if (i + 1 < backup.length && backup[i+1] && (backup[i+1].startsWith('de ') || backup[i+1].startsWith('con ') || backup[i+1].startsWith('del '))) {
                                 current = (backup[i] + ' ' + backup[i+1]).trim();
                                 i++;
                             } else if (backup[i]?.match(/^[ivxIVX]+(?:\s*-\s*[ivxIVX]+)*$/) && i + 1 < backup.length && backup[i+1]?.trim() === "") {
                                 // Handle case: "iv - iii - ii - i - v", ""
                                 current = backup[i].trim();
                                 i++;
                             } else {
                                 current = backup[i]?.trim() || "";
                             }

                             // If it's a blank string due to a weird split, just continue accumulating
                             if (current === "" && i + 1 < backup.length) {
                                 current = backup[i+1].trim();
                                 i++;
                             }

                             if (current) stitched.push(current);
                         }
                         if (stitched.length === 5 || stitched.length === 4 || stitched.length === 3) {
                             options = stitched;
                         } else {
                             // Let's filter out known junk evaluation letters from the options array that shouldn't be there
                             const filtered = stitched.filter(o => !o.match(/^[CIVF]+$/i));
                             if (filtered.length === 5 || filtered.length === 4 || filtered.length === 3) {
                                 options = filtered;
                             } else if (backup.length === 6 || backup.length === 8 || backup.length === 10 || backup.length === 12) {
                                 // Fallback to strict pairing
                                 stitched = [];
                                 for (let j = 0; j < backup.length; j += 2) {
                                     if (j + 1 < backup.length) {
                                         stitched.push((backup[j] + ' ' + backup[j+1]).trim());
                                     } else {
                                         stitched.push(backup[j].trim());
                                     }
                                 }
                                 if (stitched.length === 5 || stitched.length === 4 || stitched.length === 3) {
                                     options = stitched;
                                 }
                             }
                         }
                     }
                 }
              }

              // Let's filter out badly merged odd options from Source 3
              // We'll skip fixing them perfectly, just rely on raw if we broke it
              if (options.length > 0 && typeof options[0] === 'string') {
                  if (options.some(o => o.trim() === 'y el este (Asi' || o.trim() === 'y el este (Asi)') || options.length > 5 || options.some(o => o.trim() === 'muerte de estas.' || o.trim() === 'con menores recursos.' || o.trim() === 'C' || o.trim() === 'I' || o.includes('muerte de estas.'))) {
                      // It was bad split, let's revert to original node options
                      let backup = cleanOptions(node.alternatives);
                      if (backup.length > 0 && backup[0].includes('(') && backup[0].includes(')')) {
                         const splitOpts = backup[0].split(/\s*[a-eA-E]\)\s*/).filter(o => o.trim() !== '');
                         if (splitOpts.length === 5) {
                             backup = splitOpts.map(o => o.replace(/\s+/g, ' ').trim());
                         }
                      }
                      options = backup;
                  }
              }

              options = options.filter(o => !o.includes('Solución:') && !o.includes('Rpta.')).slice(0, 5);

              let questionText = (node.statement || '').trim();
              let rationaleText = node.rationale || '';

              if (!rationaleText) {
                  const match = questionText.match(/\n\s*(Solución|Resolución|Respuesta|Clave)[\s:.]+([\s\S]*)$/i);
                  if (match && match.index !== undefined) {
                      rationaleText = match[0].trim();
                      questionText = questionText.substring(0, match.index).trim();
                  }
              }

              let mappedTask = node.type;
              if (mappedTask === 'writing_plan') {
                  mappedTask = 'sentence_ordering';
              }

               results.push({
                source: 'source_3',
                task: mappedTask,
                question: questionText,
                options: options,
                answer: node.correct ?? 0,
                rationale: rationaleText?.trim() || null,
              });
            }
          }
        } catch (e) {
          console.error(`Failed parsing ${fullPath}`, e);
        }
      }
    }
  }

  await exploreDir(datasetDir);
  return results;
};

const run = async () => {
  console.log("Processing Source 1...");
  const s1 = await processSource1();
  console.log(`Source 1: ${s1.length} records`);

  console.log("Processing Source 2...");
  const s2 = await processSource2();
  console.log(`Source 2: ${s2.length} records`);

  console.log("Processing Source 3...");
  const s3 = await processSource3();
  console.log(`Source 3: ${s3.length} records`);

  const allInterim = [...s1, ...s2, ...s3];

  const all: FinalOutput[] = [];
  const rejected: any[] = [];

  allInterim.forEach((item, idx) => {
    // Validate answer index
    item.options = item.options.filter(o => o.trim());

    if (
      !Number.isInteger(item.answer) ||
      item.answer < 0 ||
      item.answer >= item.options.length
    ) {
      rejected.push({ id: idx, reason: "Answer index out of bounds", ...item });
      return;
    }

    if (item.options.length === 1) {
      rejected.push({ id: idx, reason: "Ill-formed options (length 1)", ...item });
      return;
    }

    if (item.options.length >= 6) {
      rejected.push({ id: idx, reason: "Ill-formed options (length >= 6)", ...item });
      return;
    }

    // Special validation for sentence_ordering from source 2
    if (item.source === 'source_2' && item.task === 'sentence_ordering') {
        item.options = item.options.map(o => o.toUpperCase());
    }

    all.push({
      id: all.length,
      task: item.task,
      question: item.question,
      options: item.options,
      answer: item.answer,
      rationale: item.rationale
    });
  });

  console.log(`Total Valid: ${all.length} records`);
  console.log(`Total Rejected: ${rejected.length} records`);

  const outPath = join(__dirname, 'dataset.json');
  await writeFile(outPath, JSON.stringify(all, null, 2), 'utf8');
  console.log(`Written to ${outPath}`);

  if (rejected.length > 0) {
      const rejectedPath = join(__dirname, 'dataset_rejected.json');
      await writeFile(rejectedPath, JSON.stringify(rejected, null, 2), 'utf8');
      console.log(`Rejected items written to ${rejectedPath}`);
  }
};

run().catch(console.error);
