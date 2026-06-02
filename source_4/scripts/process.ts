import { TextLineStream } from "@std/streams/text-line-stream";
import { z } from "zod";
import { Mistral } from "@mistralai/mistralai";
import { load } from "@std/dotenv";

type State =
  | "padded_text"
  | "text_id"
  | "text_content"
  | "numbered_exercise"
  | "alternative"
  | "solution_delimiter"
  | "solution_content"
  | "answer"
  | "jump";

const ExerciseTaskSchema = z.enum([
  "reading_comprehension",
  "sentence_elimination",
  "verbal_series",
  "synonyms_and_antonyms",
  "sentence_ordering",
  "analogies",
  "incomplete_sentences",
]);

type ExerciseKind = z.infer<typeof ExerciseTaskSchema>;

type Exercise = {
  id: number;
  task: ExerciseKind | null;
  question: string;
  options: string[];
  answer: number;
  rationale: string;

  trim(): Exercise;
};

export const Exercise = {
  init(): Exercise {
    return {
      id: 0,
      task: null,
      question: "",
      options: [],
      answer: 0,
      rationale: "",

      trim() {
        const new_ex = Exercise.init();
        new_ex.id = this.id;
        new_ex.task = this.task;
        new_ex.question = this.question.trim();
        new_ex.options = this.options.map((q) => q.trim());
        new_ex.answer = this.answer;
        new_ex.rationale = this.rationale.trim();

        return new_ex;
      },
    };
  },
};

const TaggedExerciseSchema = z.object({
  id: z.number().int().nonnegative(),
  task: ExerciseTaskSchema,
  confidence: z.number().min(0).max(1),
}).strict();

type TaggedExercise = z.infer<typeof TaggedExerciseSchema>;

type Failure = {
  error: string;
  line: number;
};

type ProcessOptions = {
  baseline_id: number;
};

const system_prompt = `
Eres un clasificador de ejercicios de razonamiento verbal en español.

Cada ejercicio pertenece exactamente a UNA categoría.

Categorías:

reading_comprehension:
Responder preguntas de razonamiento verbal basadas en un texto o pasaje largo, normalmente requiriendo interpretación, inferencia o comprensión lectora.

sentence_ordering:
Determinar el orden lógico de oraciones o fragmentos para construir un texto coherente y bien estructurado.

sentence_elimination:
Identificar la oración que NO pertenece lógica, estructural o temáticamente dentro de un conjunto.

verbal_series:
Identificar el patrón lingüístico o semántico que conecta las palabras, incluyendo categorías, secuencias, cadenas de sinónimos, cadenas de antónimos o progresión conceptual.

analogies:
Identificar la equivalencia de relación semántica entre dos pares de conceptos.

synonyms_and_antonyms:
Seleccionar la palabra con significado más cercano u opuesto respecto a una palabra o expresión objetivo.

incomplete_sentences:
Elegir la opción que completa mejor una oración según significado, gramática y coherencia contextual.

Distinciones críticas:

analogies:
- se enfoca en equivalencia relacional entre pares
- normalmente tiene estructura tipo A:B :: C:D
- NO es detección de sinónimos
- NO es progresión verbal

verbal_series:
- se enfoca en patrones de secuencia o progresión
- puede involucrar categorías, cadenas de sinónimos, cadenas de antónimos o evolución semántica
- NO es equivalencia relacional entre pares

synonyms_and_antonyms:
- se enfoca en equivalencia u oposición semántica directa
- normalmente gira alrededor de una sola palabra objetivo
- NO es razonamiento relacional entre pares

sentence_ordering:
- reconstruye una estructura coherente
- normalmente involucra fragmentos u oraciones numeradas
- NO es eliminación de oraciones

sentence_elimination:
- elimina una oración incoherente o no relacionada
- NO es reconstrucción de orden

reading_comprehension:
- requiere interpretar un texto o pasaje amplio
- normalmente es significativamente más largo que otros tipos de ejercicios

Reglas:
- Devuelve exactamente una categoría por ejercicio.
- Prioriza la intención semántica sobre el formato superficial.
- Usa la confianza de manera conservadora.
- Usa confidence < 0.90 si existe ambigüedad.
- No adivines agresivamente.`;

const checkpoint_path = "documents/ocr/exercises_checkpoint.json";

const persist = async (
  exercises: [ Exercise[], Failure[] ],
): Promise<void> => {
  await Deno.writeTextFile(
    checkpoint_path,
    JSON.stringify(exercises),
  );
};

async function preload(): Promise<[ Exercise[], Failure[] ] | null> {
  try {
    const text =
      await Deno.readTextFile(
        checkpoint_path,
      );

    return JSON.parse(text);
  } catch {
    return null;
  }
}

const delayTime = (time: number) =>
  new Promise<void>(
    (resolve) => setTimeout(() => resolve(), time),
  );

function* chunks<T>(
  array: readonly T[],
  size: number,
): Generator<readonly T[]> {
  if (size <= 0) {
    throw new Error("chunk size must be > 0");
  }

  for (let i = 0; i < array.length; i += size) {
    yield array.slice(i, i + size);
  }
}

const process_file = async (
  in_path: string,
  options: ProcessOptions,
): Promise<[Exercise[], Failure[]]> => {
  const in_file = await Deno.open(in_path, { read: true });

  const stream = in_file.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream({ allowCR: true }));

  /*
title:
- padded_text (opcional)
- text_id "TEXTO 1"
- text_content "Dentro de las áreas que constituyen a toda empresa..."

exercise:
- numbered_exercise "1. La intención principal del autor es"
- alternative (xN) "A) criticar a las cookies por robar información personal de los usuarios."
- solucion_delimiter "Solución:"
- solucion_content "El autor del texto define y describe el cumplimiento de las cookies en los sitios web, permitiendo de esta manera, dilucidar todo respecto al mensaje que aparece sobre ellas."
- answer "Rpta.: C"

jump exercise, title, eof
  */

  const exercise_pool: Exercise[] = [];
  const failure_pool: Failure[] = [];

  let exercise_buffer: Exercise = Exercise.init();
  let leading_statement: string | null = null;

  let state: State = "padded_text";
  let idx: number = 0;

  for await (const line of stream) {
    idx += 1;

    try {
      switch (state) {
        case "jump": {
          exercise_buffer.id = exercise_pool.length + options.baseline_id;

          if (exercise_buffer.options.length === 0) {
            throw new Error(`empty options on line ${idx}`);
          }

          exercise_pool.push(exercise_buffer.trim());
          exercise_buffer = Exercise.init();

          const match_exercise = /^\d+[.\)] (.*)$/;
          if (match_exercise.test(line)) {
            state = "numbered_exercise";
            if (leading_statement === null) {
              throw new Error(`no available statement to trace on line ${idx}`);
            }

            exercise_buffer.question = leading_statement;
            exercise_buffer.question += line + "\n";

            state = "alternative";
            continue;
          }

          state = "padded_text";
          leading_statement = null;
          break;
        }

        case "padded_text": {
          const id_check_pattern = /TEXTO [A-Za-z0-9]*$/;

          if (line.startsWith("TEXTO ")) {
            if (!id_check_pattern.test(line)) {
              throw new Error(`broken line "${line}" with state ${state}`);
            }

            state = "text_id";
            exercise_buffer.question += line + "\n";

            state = "text_content";
            continue;
          }

          break;
        }

        case "text_content": {
          const match_exercise = /^\d+[.\)] (.*)$/;
          if (match_exercise.test(line)) {
            state = "numbered_exercise";
            leading_statement = exercise_buffer.question;
            exercise_buffer.question += line + "\n";

            state = "alternative";
            continue;
          }

          exercise_buffer.question += line + "\n";
          break;
        }

        case "alternative": {
          const match_alternative = /^[A-Z]\)(.*)*$/;
          if (!match_alternative.test(line)) {
            if (line === "Solución:") {
              state = "solution_delimiter";
              state = "solution_content";
              continue;
            }

            throw new Error(`broken line "${line}" with state ${state}`);
          }

          exercise_buffer.options.push(line);
          break;
        }

        case "solution_content": {
          const answer_delimiter = "Rpta.: ";
          if (line.startsWith(answer_delimiter)) {
            state = "answer";

            const answer_index_alpha = line.split(answer_delimiter)[1];
            if (
              answer_index_alpha === undefined || answer_index_alpha.length != 1
            ) {
              throw new Error(`broken line ${line} with state ${state}`);
            }

            if (!/^[A-Z]$/.test(answer_index_alpha)) {
              throw new Error(`broken line ${line} with state ${state}`);
            }

            const answer_index = answer_index_alpha.charCodeAt(0);
            exercise_buffer.answer = answer_index - "A".charCodeAt(0);

            state = "jump";
            continue;
          }

          exercise_buffer.rationale += line + "\n";
          break;
        }
      }
    } catch (err) {
      console.log(`${err}, storing to known failures and resetting state`);
      failure_pool.push({
        error: (err as Error).message,
        line: idx,
      });

      state = "padded_text";
      exercise_buffer = Exercise.init();
    }
  }

  return [exercise_pool, failure_pool];
};

const generate_exercises = async (in_path: string): Promise<Exercise[]> => {
  const env = await load();
  const client = new Mistral({
    apiKey: env.MISTRAL_API_KEY!,
  });

  const checkpoint = await preload();

  const exercises = checkpoint ?? await process_file(in_path, {
    baseline_id: 13829,
  });

  const pending = exercises[0].filter(
    (ex) => ex.task === null,
  );

  const batch_size = 5;
  let processed = batch_size;
  for (const batch of chunks(pending, batch_size)) {
    while (true) {
      const response = await client.chat.parse({
        model: "mistral-medium-2505",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: system_prompt,
          },
          {
            role: "user",
            content: JSON.stringify(batch),
          },
        ],
        responseFormat: z.array(TaggedExerciseSchema),
      });

      const choices = response.choices;
      if (choices === undefined || choices.length === 0) {
        console.error("model returned undefined choices")
        continue;
      }

      const main_choice = choices[0];
      if (main_choice === undefined) {
        console.error("model returned undefined main choice")
        continue;
      }

      const main_message = main_choice.message;
      if (main_message === undefined) {
        console.error("model returned undefined main message")
        continue;
      }

      const main_chunk = main_message.parsed;
      if (main_chunk === undefined || main_chunk === null) {
        console.error("model returned undefined main chunk")
        continue;
      }

      const parsed = main_chunk as unknown as TaggedExercise[];
      if (parsed.length !== batch.length) {
        console.error("model returned wrong size")
        continue;
      }

      try {
        parsed.forEach((parsed_ex) => {
          const idx = exercises[0].findIndex((ex) => ex.id === parsed_ex.id);
          if (idx === -1) {
            throw new Error("wrong id from model");
          }

          exercises[0][idx].task = parsed_ex.task;
        });
      } catch {
        console.log("wrong id");
        continue;
      }

      console.log(`processed ${processed} out of ${pending.length}`);
      processed += batch.length;

      break;
    }

    await persist(exercises);
    await delayTime(3000);
  }

  return exercises[0];
};

const in_path = "documents/ocr/clean_text.txt";
const out_path = "documents/ocr/exs.json";

const exercises = await generate_exercises(in_path);

const exercises_json = JSON.stringify(exercises);
await Deno.writeTextFile(out_path, exercises_json, {
  create: true,
  append: false,
});

const stats = new Map<ExerciseKind, number>();
stats.set("reading_comprehension", 0);
stats.set("sentence_elimination", 0);
stats.set("verbal_series", 0);
stats.set("synonyms_and_antonyms", 0);
stats.set("sentence_ordering", 0);
stats.set("analogies", 0);
stats.set("incomplete_sentences", 0);

exercises.forEach(ex => {
  if (ex.task === null) {
    throw new Error("null task kind");
  }

  const curr = stats.get(ex.task);
  if (curr === undefined) {
    throw new Error("unreachable");
  }

  stats.set(ex.task, curr + 1);
})

console.log("stats:", stats);

export {};
