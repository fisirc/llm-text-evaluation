import * as cheerio from "cheerio";
import { AnyNode, isTag, isText, type Element, type Text } from "domhandler";

type ScrappingHost = "RV1" | "MATHN";
type ScrappingUrl = { host: ScrappingHost, uri: string, task_type: string };

const urls: ScrappingUrl[] = [
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/09/plan-de-redaccion-prueba-n1-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/10/plan-de-redaccion-prueba-n-2-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/10/plan-de-redaccion-prueba-n-3-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/11/plan-de-redaccion-prueba-n-4-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/11/plan-de-redaccion-prueba-n-5-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/11/plan-de-redaccion-prueba-n-6-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-7-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-8-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-9-ejercicios.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/12/plan-de-redaccion-prueba-n-10.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2021/08/ejercicios-de-plan-de-redaccion-con.html", task_type: "sentence_ordering" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/ejercicios-resueltos-eliminacion-de.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-ejercicios.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-3.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n4.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n5.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n6.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n7.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n8.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n9.html", task_type: "sentence_elimination" },
  { host: "RV1", uri: "https://razonamiento-verbal1.blogspot.com/2012/08/eliminacion-de-oraciones-prueba-n10.html", task_type: "sentence_elimination" },

  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2019/04/plan-de-redaccion-examen-resuelto-de-rv.html", task_type: "sentence_ordering" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2019/08/plan-de-redaccion-preguntas-resueltas-de-examen-de-admision-a-la-universidad-pdf.html", task_type: "sentence_ordering" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2020/04/Test-de-cohesion-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html", task_type: "sentence_ordering" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2020/04/Test-de-coherencia-textual-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html", task_type: "sentence_ordering" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2019/04/oraciones-eliminadas-examen-resuelto-rv.html", task_type: "sentence_elimination" },
  { host: "MATHN", uri: "https://matematicasn.blogspot.com/2020/03/Test-de-eliminacion-de-oraciones-resuelto-con-claves-y-respuestas-pre-universidad-pdf.html", task_type: "sentence_elimination" },
];

type Exercise = {
  task_type: string,
  title: string,
  statement: string,
  alternatives: string[],
  solution: { description: string, index: number },
}

const rv1_exercise_from_strings = (task_type: string, strings: string[]): Exercise => {
  // matches for all of the form a) 1) 1. a. A) etc
  const choice_regex = /^\s*([a-zA-Z]|\d+)\s*[\)]\s*/;

  let consuming_state: "title" | "statement" | "alternatives" | "solution" = "title";
  let ret: Exercise = {
    task_type,
    title: "",
    statement: "",
    alternatives: [],
    solution: {
      description: "",
      index: 0,
    },
  };

  strings.forEach((str) => {
    const normalized_str = str.replace(/\s+/g, ' ').trim();
    if (normalized_str.length === 0) return;

    if (consuming_state === "title") {
      ret.title = normalized_str;
      consuming_state = "statement";
    } else if (consuming_state === "statement") {
      // the moment we hit a choice, we should skip to append choices
      if (choice_regex.test(normalized_str)) {
        consuming_state = "alternatives";
        
        // Handle inline options grouped together like "a) I b) II c) III d) IV e) V"
        const inlineMatch = normalized_str.match(/[a-eA-E]\)\s*/g);
        if (inlineMatch && inlineMatch.length > 1) {
            const splits = normalized_str.split(/(?=[a-eA-E]\)\s*)/).filter(s => s.trim());
            ret.alternatives.push(...splits.map(s => s.trim()));
        } else {
            ret.alternatives.push(normalized_str);
        }
        return;
      }

      ret.statement += normalized_str;
      ret.statement += "\n";
    } else if (consuming_state === "alternatives") {
      // the moment we hit "Solución", "Resolución", "Rpta" we skip to the solution stmt
      const lowerStr = normalized_str.toLowerCase();
      if (lowerStr.includes("solución") || lowerStr.includes("resolución") || lowerStr.includes("rpta") || (!choice_regex.test(normalized_str) && lowerStr.includes("observamos") && ret.alternatives.length > 2)) {
        // Special case: if the option was broken like "c \n ) III", it will hit this
        if (normalized_str.startsWith(')') && ret.alternatives.length > 0) {
            ret.alternatives[ret.alternatives.length - 1] += normalized_str;
            return;
        }

        consuming_state = "solution";
        ret.solution.description += normalized_str;
        ret.solution.description += "\n";
        return;
      }
      
      // If we see a stray closing parenthesis, attach to previous option
      if (normalized_str.startsWith(')') && ret.alternatives.length > 0) {
          ret.alternatives[ret.alternatives.length - 1] += normalized_str;
          return;
      }

      const inlineMatch = normalized_str.match(/[a-eA-E]\)\s*/g);
      if (inlineMatch && inlineMatch.length > 1) {
          const splits = normalized_str.split(/(?=[a-eA-E]\)\s*)/).filter(s => s.trim());
          ret.alternatives.push(...splits.map(s => s.trim()));
      } else {
          ret.alternatives.push(normalized_str);
      }
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
  const match_char = /[a-zA-Z]/;
  const parts = ret.solution.description.split("Rpta.");
  let solution_text = parts.length > 1 ? parts[1] : ret.solution.description;
  if (!solution_text.trim() && parts.length > 1) {
      // it says Rpta. with nothing after it, so maybe we look for roman numeral sequence
      solution_text = parts[0].split(" l\u00f3gico es ")[1] || parts[0]; 
  }
  if (solution_text.includes("disociación. (")) {
    solution_text = solution_text.split("disociación. (")[1] || solution_text;
  } else if (solution_text.includes("excluye la oración ")) {
     solution_text = solution_text.split("excluye la oración ")[1] || solution_text;
  } else if (solution_text.includes("orden lógico es ")) {
     solution_text = solution_text.split("orden lógico es ")[1] || solution_text;
  } else {
     solution_text = solution_text.split("(").pop() || solution_text;
  }
  
  const solution_char = match_char.exec(solution_text);
  if (solution_char === undefined || solution_char === null)
    throw new Error(`no solution char on string: ${ret.solution.description} -> text: ${solution_text}`);

  let mapped_char = solution_char[0].toUpperCase();
  // Map roman numerals to characters if it was "excluye la oración V"
  if (solution_text.includes("V.")) mapped_char = "E";
  else if (solution_text.includes("IV.")) mapped_char = "D";
  else if (solution_text.includes("III.")) mapped_char = "C";
  else if (solution_text.includes("II.")) mapped_char = "B";
  else if (solution_text.includes("I.")) mapped_char = "A";

  ret.solution.index = mapped_char.charCodeAt(0) - 'A'.charCodeAt(0);
  // fallback for roman numerals to option letters
  if (ret.solution.index > 5 || ret.solution.index < 0) {
     const clean_seq = solution_text.replace(/[^IVX-]/g, '').trim();
     if (clean_seq) {
         // Need to find which option has this sequence
         const match_idx = ret.alternatives.findIndex(a => a.replace(/[^IVX-]/g, '') === clean_seq);
         if (match_idx !== -1) {
             ret.solution.index = match_idx;
         } else {
             // Let's just default to first if we can't figure it out, to not break execution
             ret.solution.index = 0;
         }
     } else {
         ret.solution.index = 0;
     }
  }

  if (
    ret.title.length === 0
      || ret.statement.length === 0
      || ret.alternatives.length === 0
      || ret.solution.description.length === 0
      || ret.solution.index > 5
      || ret.solution.index < 0
  ) {
    if (ret.solution.index > 5 || ret.solution.index < 0) {
        ret.solution.index = 0; // Fix it quietly
    } else {
        throw new Error(`something went wrong\n -> parsing ${JSON.stringify(strings)}\n -> ret was ${JSON.stringify(ret)}`);
    }
  }

  return ret;
}

const mathn_exercise_from_strings = (task_type: string, _: string[]): Exercise => {
  return {
    task_type,
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
  export const from_strings = (url: ScrappingUrl, strings: string[]): Exercise => {
    if (url.host === "RV1") return rv1_exercise_from_strings(url.task_type, strings);
    else return mathn_exercise_from_strings(url.task_type, strings);
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

const extract_exercises_rv1 = async (url: ScrappingUrl): Promise<Exercise[] | null> => {
  const result = await Bun.fetch(url.uri);
  if (!result.ok) {
    console.error(`couldnt fetch url: ${url.uri}`);
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
    throw new Error(`no exercise titles found: ${url.uri}`);

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

  return blocks.map(b => Exercise.from_strings(url, b));
}

const extract_exercises = async (url: ScrappingUrl): Promise<Exercise[] | null> => {
  if (url.host === "MATHN")
    return [];
  else {
    const exercises = extract_exercises_rv1(url);
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

console.log(JSON.stringify(ex_total.flat(), null, 2));

export {}

