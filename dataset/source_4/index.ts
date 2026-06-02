import z from "zod";
import { parse_args } from "./lib/args.ts";
import { type ExerciseTask, ExerciseTaskSchema } from "./lib/exercise_types.ts";
import { assert } from "./lib/result.ts";
import { cmd_generate } from "./lib/cmd/generate/cmd.ts";
import { client } from "./lib/ai.ts";
import { load } from "@std/dotenv";
import { cmd_run } from "./lib/cmd/run/cmd.ts";
import { Cache } from "./lib/cache.ts";

const usage_string = `
Usage: newborn [options] [command]

options:
  --envfile=<string>,
  --cachedir=<string>,

commands:

generate <task> <amount> <output_file>
  generates some <amount> of exercises of a given <task> type, using a generative
  model, then outputs the exercises to <output_file>. <task> can be one of:
  - reading_comprehension
  - sentence_elimination
  - verbal_series
  - synonyms_and_antonyms
  - sentence_ordering
  - analogies
  - incomplete_sentences

run <input_dir> <output_file>
  baseline run, reads the documents from <input_dir>, then parses and outputs
  their exercises to a json-formatted <output_file>.

help
  print this message
`;

const print_usage = () => {
  console.log(usage_string);
};

const CmdSchema = z.enum(["generate", "run", "help"]);
const ArgsSchema = z.object({
  // environment file that contains the API key
  envfile: z.optional(z.string()),
  // cache directory
  cachedir: z.optional(z.string()),
  // commands to run
  _: z.union([
    z.tuple([
      CmdSchema.extract(["generate"]),
      ExerciseTaskSchema,
      z.string(),
      z.string(),
    ]),
    z.tuple([CmdSchema.extract(["run"]), z.string(), z.string()]),
    z.tuple([CmdSchema.extract(["help"])]),
  ]),
});

type Args =
  | {
    command: "generate";
    env_file: string;
    cache_dir: string;
    task: ExerciseTask;
    amount: number;
    output_file: string;
  }
  | {
    command: "run";
    env_file: string;
    cache_dir: string;
    input_dir: string;
    output_file: string;
  }
  | { command: "help" };

const get_program_args = (): Args => {
  const default_cache_dir_path = ".cache";
  const default_env_file_path = ".env";

  const args = parse_args(Deno.args, ArgsSchema, {
    string: ["_", "env", "cache"],
  });

  if (args.tag === "err") {
    print_usage();
    Deno.exit(1);
  }

  if (args.val._[0] === "generate") {
    return {
      env_file: args.val.envfile ?? default_env_file_path,
      cache_dir: args.val.cachedir ?? default_cache_dir_path,
      command: "generate",
      task: args.val._[1],
      amount: Number(args.val._[2]),
      output_file: args.val._[3],
    };
  } else if (args.val._[0] === "run") {
    return {
      env_file: args.val.envfile ?? default_env_file_path,
      cache_dir: args.val.cachedir ?? default_cache_dir_path,
      command: "run",
      input_dir: args.val._[1],
      output_file: args.val._[2],
    };
  } else if (args.val._[0] === "help") {
    return {
      command: "help",
    };
  }

  assert(false);
};

const args = get_program_args();
if (args.command === "help") {
  print_usage();
  Deno.exit(0);
}

const cache = await Cache.init(args.cache_dir);
const env = await load({
  envPath: args.env_file,
});

const mistral_api_key = env.MISTRAL_API_KEY;
if (mistral_api_key === undefined) {
  console.error("no api key was provided in the environment");
  Deno.exit(1);
}

const mistral_client = client(mistral_api_key);

if (args.command === "generate") {
  const res = await cmd_generate(
    mistral_client,
    args.output_file,
    args.task,
    args.amount,
  );

  if (res.tag === "err") {
    console.error(res.error);
    Deno.exit(1);
  }

  console.log("done!");
  Deno.exit(0);
}

if (args.command === "run") {
  const res = await cmd_run(
    mistral_client,
    cache,
    args.input_dir,
    args.output_file,
  );

  if (res.tag === "err") {
    console.error(res.error);
    Deno.exit(1);
  }

  console.log("done!");
  Deno.exit(0);
}
