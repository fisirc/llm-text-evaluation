import * as cheerio from "cheerio";
import { AnyNode, isTag, isText, type Element, type Text } from "domhandler";

type ScrappingHost = "RV1" | "MATHN";
type ScrappingUrl = { host: ScrappingHost, uri: string };

const urls: ScrappingUrl[] = [
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/09/plan-de-redaccion-prueba-n1-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/10/plan-de-redaccion-prueba-n-2-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/10/plan-de-redaccion-prueba-n-3-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/11/plan-de-redaccion-prueba-n-4-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/11/plan-de-redaccion-prueba-n-5-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/11/plan-de-redaccion-prueba-n-6-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-7-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-8-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-9-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-10.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2021/08/ejercicios-de-plan-de-redaccion-con.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/ejercicios-resueltos-eliminacion-de.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-ejercicios.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-3.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n4.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n5.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n6.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n7.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n8.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n9.html" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n10.html" },

  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2019/04/plan-de-redaccion-examen-resuelto-de-rv.html" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2019/08/plan-de-redaccion-preguntas-resueltas-de-examen-de-admision-a-la-universidad-pdf.html" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2020/04/Test-de-cohesion-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2020/04/Test-de-coherencia-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2019/04/oraciones-eliminadas-examen-resuelto-rv.html" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2020/03/Test-de-eliminacion-de-oraciones-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html" },
];

type Exercise = {
  title: string,
  statement: string,
  alternatives: string[],
  solution: { description: string, index: number },
}

const rv1_exercise_from_strings = (strings: string[]): Exercise => {
  // matches for all of the form a) 1) 1. a. A) etc
  const choice_regex = /^\s*([a-zA-Z]|\d+)\s*[\)]\s*/;

  let consuming_state: "title" | "statement" | "alternatives" | "solution" = "title";
  let ret: Exercise = {
    title: "",
    statement: "",
    alternatives: [],
    solution: {
      description: "",
      index: 0,
    },
  };

  strings.forEach((str) => {
    const normalized_str = str.trim();
    if (normalized_str.length === 0) return;

    if (consuming_state === "title") {
      ret.title = normalized_str;
      consuming_state = "statement";
    } else if (consuming_state === "statement") {
      // the moment we hit a choice, we should skip to append choices
      if (choice_regex.test(normalized_str)) {
        consuming_state = "alternatives";
        ret.alternatives.push(normalized_str);
        return;
      }

      ret.statement += normalized_str;
      ret.statement += "\n";
    } else if (consuming_state === "alternatives") {
      // the moment we dont hit a choice, we should skip to the solution stmt
      if (!choice_regex.test(normalized_str)) {
        consuming_state = "solution";
        ret.solution.description += normalized_str;
        ret.solution.description += "\n";
        return;
      }

      ret.alternatives.push(normalized_str);
    } else if (consuming_state === "solution") {
      ret.solution.description += normalized_str;
      ret.solution.description += "\n";
    }
  });

  // leading whitespaces
  ret.title = ret.title.trim();
  ret.statement = ret.statement.trim();
  ret.solution.description = ret.solution.description.trim();

  // the correct solution is of the form [a-z] on the last chars
  const match_char = /[a-zA-z]/;
  const solution_char = match_char.exec(ret.solution.description);
  if (solution_char === undefined || solution_char === null)
    throw new Error(`no solution char on string: ${ret.solution.description}`);

  ret.solution.index = solution_char[0].charCodeAt(0) - 'a'.charCodeAt(0);

  if (
    ret.title.length === 0
      || ret.statement.length === 0
      || ret.alternatives.length === 0
      || ret.solution.description.length === 0
      || ret.solution.index > 5
      || ret.solution.index < 0
  ) {
    throw new Error(`something went wrong\n -> parsing ${JSON.stringify(strings)}\n -> ret was ${JSON.stringify(ret)}`);
  }

  return ret;
}

const mathn_exercise_from_strings = (_: string[]): Exercise => {
  return {
    title: "",
    statement: "",
    alternatives: [],
    solution: {
      description: "",
      index: 0,
    },
  };
}

namespace Exercise {
  export const from_strings = (host: ScrappingHost, strings: string[]): Exercise => {
    if (host === "RV1") return rv1_exercise_from_strings(strings);
    else return mathn_exercise_from_strings(strings);
  };
}


const inner_text = (doc: cheerio.CheerioAPI, el: AnyNode): string => {
  if (doc(el).hasClass("adsbygoogle"))
    return "";

  if (doc(el).is("script"))
    return "";

  if (el.type == "text")
    return el.data;

  if (doc(el).contents().length === 0)
    return doc(el).text();

  return doc(el)
    .contents()
    .toArray()
    .map(c => inner_text(doc, c).trim())
    .join("\n");
}

const extract_exercises_rv1 = async (uri: string): Promise<Exercise[] | null> => {
  const result = await Bun.fetch(uri);
  if (!result.ok) {
    console.error(`couldnt fetch url: ${uri}`);
    return null;
  }

  const content = await result.text();
  const $ = cheerio.load(content);

  const main = $(".post-body.entry-content")
    .children()
    .get(0);

  if (main === undefined) throw new Error("breakpoint: undefined");

  const contents = inner_text($, main)
    .split("\n")
    .filter(str => str.length !== 0);

  const exercise_matcher = /^(Ejercicio|PREGUNTA)/;

  const first_ex_idx = contents.findIndex(str => exercise_matcher.test(str));
  if (first_ex_idx === -1)
    throw new Error(`no exercise titles found: ${uri}`);

  const blocks: string[][] = [];

  let current_block: string[] = [];
  contents.slice(first_ex_idx).forEach(str => {
    if (exercise_matcher.test(str)) {
      if (current_block.length !== 0) {
        blocks.push(current_block);
      }

      current_block = [];
      return;
    }

    current_block.push(str);
  });

  return blocks.map(b => Exercise.from_strings("RV1", b));
}

const extract_exercises = async (url: ScrappingUrl): Promise<Exercise[] | null> => {
  if (url.host === "MATHN")
    return [];
  else {
    const exercises = extract_exercises_rv1(url.uri);
    if (exercises === null) {
      console.error(`couldnt parse exercises: ${url}`);
      return null;
    }

    return exercises;
  }
}

const ex_total_promises = urls
  .filter(u => u.host === "RV1")
  .flatMap(url => extract_exercises(url));

const ex_total = await Promise.all(ex_total_promises);

ex_total.forEach(e => {
  console.log(e);
});

export {}

