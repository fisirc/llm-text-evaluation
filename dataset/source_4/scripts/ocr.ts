import { Mistral } from "@mistralai/mistralai";
import { load } from "@std/dotenv";
import { exists } from "@std/fs/exists";
import { encodeHex } from "@std/encoding/hex";

type CacheOptions = {
  cache_dir: string;
};

class Cache {
  cache_dir: string;

  private constructor(options: CacheOptions) {
    this.cache_dir = options.cache_dir;
  }

  static async init(options: CacheOptions): Promise<Cache> {
    const cache_exists = await exists(options.cache_dir);
    if (!cache_exists) await Deno.mkdir(options.cache_dir);
    return new Cache(options);
  }

  private async hash_name(name: string): Promise<string> {
    const message_buffer = new TextEncoder().encode(name);
    const message_hash = await crypto.subtle.digest("SHA-256", message_buffer);
    return encodeHex(message_hash);
  }

  async find(name: string): Promise<string | null> {
    const hashed_name = await this.hash_name(name);
    const hashed_path = `${this.cache_dir}/${hashed_name}`;

    if (await exists(hashed_path)) {
      return hashed_path;
    } else {
      return null;
    }
  }

  async write_at(name: string, content: string): Promise<string> {
    const hashed_name = await this.hash_name(name);
    const hashed_path = `${this.cache_dir}/${hashed_name}`;

    await Deno.writeTextFile(hashed_path, content, { create: true });
    return hashed_path;
  }
}

const get_raw_from = async (str: string): Promise<string> => {
  const response = await fetch(`${str}?raw=true`, {
    redirect: "manual",
  });

  const raw_link = response.headers.get("x-raw-download");
  if (raw_link === null) throw new Error("null raw link");

  return raw_link;
};

const documents = await Promise.all(
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

const markdown_from_document = async (
  mistral: Mistral,
  document_url: string,
): Promise<string> => {
  const result = await mistral.ocr.process({
    model: "mistral-ocr-2512",
    document: {
      type: "document_url",
      documentUrl: document_url,
    },
  });

  const mashed = result.pages
    .map((p) => p.markdown)
    .join("\n");

  return mashed;
};

const verify = (env: Record<string, string>): boolean => {
  return env.CACHE_DIR !== undefined &&
    env.MISTRAL_API_KEY !== undefined &&
    env.OUT_FILE !== undefined;
};

const process_all_documents = async (): Promise<void> => {
  const env = await load();
  if (!verify(env)) {
    throw new Error("env did not pass the verification");
  }

  console.log("loaded env");

  const cache = await Cache.init({
    cache_dir: env.CACHE_DIR,
  });

  console.log("inited cache");

  const mistral = new Mistral({
    apiKey: env.MISTRAL_API_KEY,
  });

  console.log("inited mistral");

  const paths: Promise<string>[] = documents.map(async (document) => {
    const path = await cache.find(document);
    if (path !== null) {
      console.log(`document ${document} already in cache, skipping...`);
      return path;
    }

    const markdown_document = await markdown_from_document(mistral, document);

    const new_path = await cache.write_at(document, markdown_document);
    console.log(`finished new document ${new_path}`);
    return new_path;
  });

  const paths_resolved = await Promise.all(paths);
  console.log("processed all the files, merging...");

  const merged_file = await Deno.open(env.OUT_FILE, {
    write: true,
    create: true,
    truncate: true,
  });
  const outfile_writer_stream = merged_file.writable;

  try {
    for (const path of paths_resolved) {
      const origin = await Deno.open(path);
      await origin.readable
        .pipeTo(outfile_writer_stream, { preventClose: true });
    }
  } finally {
    console.log("merged. closing...");
    await outfile_writer_stream.close();
  }
};

await process_all_documents();

export {};
