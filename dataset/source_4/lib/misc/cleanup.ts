import { TextLineStream } from "@std/streams/text-line-stream";

const acceptable = (line: string): string | null => {
  const acceptable_ascii_extras = new Set([
    '"',
    "'",
    " ",
    "%",
    "(",
    ")",
    ",",
    "-",
    ".",
    "/",
    ":",
    ";",
    "=",
    "_",
    "¿",
    "?",
    "¡",
    "!",
    "°",
    "$",
    "+",
    "|",
  ]);

  const valid_inside_quotes = new Set([
    "[",
    "]",
  ]);

  let inside_quotes: boolean = false;

  const invalid = Array.from(line).find((c) => {
    if (c === '"') {
      inside_quotes = !inside_quotes;
      return false;
    }

    const is_letter = /\p{L}/u.test(c);
    const is_mark = /\p{M}/u.test(c);
    const is_number = /\p{N}/u.test(c);
    const is_valid = acceptable_ascii_extras.has(c);
    const is_valid_quoted = valid_inside_quotes.has(c) && inside_quotes;

    return !is_letter &&
      !is_mark &&
      !is_number &&
      !is_valid &&
      !is_valid_quoted;
  });

  return invalid === undefined ? line : null;
};

const cleanup_line = (line: string): string | null => {
  const lowercase_line = line.toLowerCase();
  const is_trash =
    lowercase_line.includes("universidad nacional mayor de san marcos") ||
    lowercase_line.includes("universidad del perú, decana de américa") ||
    lowercase_line.includes("centro preuniversitario") ||
    lowercase_line.includes("semana n.") ||
    lowercase_line.includes("semana n°") ||
    lowercase_line.includes("sección") ||
    // "Ciclo Ordinario 2023-II" should be the longest possibility for
    // discarding
    (lowercase_line.startsWith("ciclo ") && lowercase_line.length <= 23);

  if (is_trash) {
    return null;
  }

  const corrections = {
    "–": "-",
    "—": "-",
    "«": '"',
    "»": '"',
    "“": '"',
    "”": '"',
    "‘": '"',
    "’": '"',
    "®": "",
    "&amp;": "y",
    "&lt;": "<",
    "&gt;": ">",
    "[...]": "(...)",
    "(Prohibida su reproducción y/o venta)": "",
    "ALBERTO CRUZ": "",
    "UNMSM-CENTRO PREUNIVERSITARIO": "",
    "#": "",
    "*": "",
    "Answer:": "Rpta.:",
    "Key:": "Rpta.:",
    "Respuesta:": "Rpta.:",
    "Solution:": "Solución:",
  };

  const corrected = Object.entries(corrections).reduce(
    (prev, [from, to]) => prev.replaceAll(from, to),
    line,
  );

  const cleaned_line = corrected
    // additional in-line whitespace removal
    .replaceAll(/ {2,}/g, " ")
    // leading whitespace removal
    .trim()
    // trash disposal
    .replaceAll(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replaceAll(/!\[([^\]]*)\]\[[^\]]*\]/g, "")
    .replaceAll(/^\[[^\]]+\]:\s+\S+[^\n]*$/gm, "")
    .replaceAll(
      /(?:http[s]?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/gm,
      "",
    )
    // closing cleanup
    .replaceAll(/ {2,}/g, " ")
    .trim();

  const acceptance_passed_line = acceptable(cleaned_line);
  if (acceptance_passed_line === null) {
    return null;
  }

  if (acceptance_passed_line.length === 0) {
    return null;
  }

  return acceptance_passed_line;
};

export const clean_file = async (
  input: Deno.FsFile,
  output: Deno.FsFile,
): Promise<void> => {
  await input.readable
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream({ allowCR: true }))
    .pipeThrough(
      new TransformStream<string, string>({
        transform(chunk, controller) {
          const cleaned = cleanup_line(chunk);
          if (cleaned === null) return;
          controller.enqueue(cleaned + "\n");
        }
      })
    )
    .pipeThrough(new TextEncoderStream())
    .pipeTo(output.writable);
};
