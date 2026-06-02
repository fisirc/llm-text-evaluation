import z from "zod";

export const ExerciseTaskSchema = z.enum([
  "reading_comprehension",
  "sentence_elimination",
  "verbal_series",
  "synonyms_and_antonyms",
  "sentence_ordering",
  "analogies",
  "incomplete_sentences",
]);

export type ExerciseTask = z.infer<typeof ExerciseTaskSchema>;

export const ExerciseSchema = z.object({
  task: ExerciseTaskSchema,
  question: z.string(),
  options: z.array(z.string()).refine(arr => arr.length === 5),
  answer: z.number().min(0).max(4),
})

export type Exercise = z.infer<typeof ExerciseSchema>;


