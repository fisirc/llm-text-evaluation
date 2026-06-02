import { Mistral } from "@mistralai/mistralai";
import { GenerateOptions, MistralModel, MistralOcr } from "../../ai.ts";
import { Result, ok, assert, error } from "../../result.ts";
import { Cache } from "../../cache.ts";
import { clean_file } from "../../misc/cleanup.ts";

// temporal workaround to prevent file uploads slowing down the process, we use
// a fixed github repository as a cdn to fetch the doc files from
const get_raw_from = async (str: string): Promise<string> => {
  const response = await fetch(`${str}?raw=true`, {
    redirect: "manual",
  });

  const raw_link = response.headers.get("x-raw-download");
  if (raw_link === null) throw new Error("null raw link");

  return raw_link;
};
// we resolve all the urls concurrently to their actual raw file url
const urls = await Promise.all(
  [
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%201-1-22.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%2010-1-16.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%202-1-18.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%203-1-21.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%204-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%205-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%206-1-16.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%207-1-16.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%208-1-17.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/1_SOLUCIONARIO%20SEM%209-1-15.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%201-1-15.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2010-1-15.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2011-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2012-1-12.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2013-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2014-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2015-1-16.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%2016-1-15.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%202-1-13.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%203-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%204-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%205-1-12.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%206-1-13.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%207-1-15.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%208-1-13.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/2_SOLUCIONARIO%20SEM%209-1-16.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%201-1-12.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2010-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2011-1-13.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2012-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2013-1-12.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2014-1-16.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2015-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2016-1-12.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2017-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%2018-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%202-1-13.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%203-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%204-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%205-1-14.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%206-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%207-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%208-1-11.pdf",
    "https://github.com/pandadiestro/tmp/blob/master/3_SOLUCIONARIO%20SEM%209-1-12.pdf",
  ]
    .map(get_raw_from),
);

const fetch_from_ocr = async (client: Mistral, model: MistralOcr, url: string): Promise<string> => {
  const res = await client.ocr.process({
    model: model,
    document: {
      type: "document_url",
      documentUrl: url,
    },
  });

  const content = res.pages
    .map(p => p.markdown.trim())
    .join("\n");

  return content;
}

const fetch_with_cache = async (client: Mistral, model: MistralOcr, cache: Cache, url: string): Promise<string> => {
  const cached_file = await cache.find(url);
  if (cached_file === null) {
    const ocr_text = await fetch_from_ocr(client, model, url);
    await cache.write_at(url, ocr_text);
    return ocr_text;
  }

  return await Deno.readTextFile(cached_file);
}

const fetch_and_pipe = async (
  client: Mistral,
  model: MistralOcr,
  cache: Cache,
  url: string,
  file: Deno.FsFile,
): Promise<Result<void, string>> => {
  const content = await fetch_with_cache(client, model, cache, url);
  const encoder = new TextEncoder();

  try {
    let written: number = 0;
    while (written < content.length) {
      const content_buffer = content.slice(written);
      const buffer_encoded = encoder.encode(content_buffer);
      const written_bytes = await file.write(buffer_encoded);
      written += written_bytes;
    }
  } catch (err) {
    const actual_err = err as Error;
    return error(`couldn't write to file: ${actual_err.message}`);
  }

  return ok(void{});
}

const get_all_urls = () => urls;

// this command, performs ocr over all files of the input dir, merging them into
// a new markdown file, then it parses that markwdown
export const cmd_run = async (
  client: Mistral,
  cache: Cache,
  input_dir: string,
  output_file: string,
  options?: GenerateOptions,
): Promise<Result<void, string>> => {
  const out_file = await Deno.open(output_file, {
    create: true,
    write: true,
    truncate: true,
  });

  // this file will be merged and will lack cleanup
  const [ raw_file ] = await cache.open_unhashed("temp", {
    write: true,
    read: true,
    create: true,
  });

  const [ cleanup_file ] = await cache.open_unhashed("temp_clean", {
    write: true,
    read: true,
    create: true,
  });

  const document_urls = get_all_urls();
  for (const url of document_urls) {
    await fetch_and_pipe(
      client,
      "mistral-ocr-2512",
      cache,
      url,
      raw_file,
    );
  }

  await raw_file.seek(0, Deno.SeekMode.Start);
  await clean_file(raw_file, cleanup_file);
  return ok(void{});
}

