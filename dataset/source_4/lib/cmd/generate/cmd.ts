import { Mistral } from "@mistralai/mistralai";
import { ExerciseSchema, ExerciseTask } from "../../exercise_types.ts";
import z from "zod";
import { error, ok, Result } from "../../result.ts";
import { prompt, spanish } from "./sysprompt.ts";
import { GenerateOptions, MistralGp } from "../../ai.ts";

const gen_exercises = async (
  client: Mistral,
  model: MistralGp,
  task: ExerciseTask,
  amount: number,
): Promise<
  Result<
    Awaited<ReturnType<typeof client.chat.parseStream>>,
    string
  >
> => {
  try {
    const res = await client.chat.parseStream(
      {
        messages: [
          {
            role: "system",
            content: spanish,
          },
          {
            role: "user",
            content: `Generate ${amount} exercises of the ${task} type, in spanish.`,
          },
        ],
        model: model,
        temperature: 1.5,
        responseFormat: z.array(ExerciseSchema).length(amount),
      },
      {},
    );

    return ok(res);
  } catch (err) {
    const gen_error = err as Error;
    return error(`couldn't generate exercise stream: ${gen_error.message}`);
  }
};

export const cmd_generate = async (
  client: Mistral,
  output_file: string,
  task: ExerciseTask,
  amount: number,
): Promise<Result<void, string>> => {
  const model: MistralGp = "mistral-large-2512";
  const exercise_stream = await gen_exercises(client, model, task, amount);
  if (exercise_stream.tag === "err") {
    return error(`couldn't generate exercises: ${exercise_stream.error}`);
  }

  const out_file = await Deno.open(output_file, {
    create: true,
    truncate: true,
    write: true,
  });

  const line_stream = exercise_stream.val;
  try {
    await line_stream
      .pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue((chunk.data.choices[0] ?? [""]).delta.content ?? "");
          },

          flush(controller) {
            controller.enqueue("\n");
          }
        }),
      )
      .pipeThrough(new TextEncoderStream())
      .pipeTo(out_file.writable);
  } catch (err) {
    const actual_error = err as Error;
    return error(`piping failed: ${actual_error.message}`);
  }

  return ok(void{});
};
