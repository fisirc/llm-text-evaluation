import { z } from "zod";
import { parseArgs, ParseOptions } from "@std/cli/parse-args";
import {
  type Result,
  error,
  ok,
} from "./result.ts";

// schema must allow for a "trailing args" arg "_", which may contain additional
// arguments passed not as flags
export const parse_args = <T>(
  raw: string[],
  schema: z.ZodType<T>,
  parser_options: ParseOptions
): Result<T, Error> => {
  const args = parseArgs(raw, parser_options);

  const parsed = schema.safeParse(args)
  if (!parsed.success) {
    return error(new Error(`invalid arguments`));
  }

  return ok(parsed.data);
}



