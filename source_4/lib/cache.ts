import { exists } from "@std/fs/exists";
import { encodeHex } from "@std/encoding/hex";

export class Cache {
  cache_dir: string;

  private constructor(cache_dir: string) {
    this.cache_dir = cache_dir;
  }

  static async init(cache_dir: string): Promise<Cache> {
    // from deno docs: when recursive is set to true, succeeds silently (without
    // changing any permissions) if a directory already exists at the path, or
    // if the path is a symlink to an existing directory.
    await Deno.mkdir(`${cache_dir}/unhashed`, { recursive: true });
    return new Cache(cache_dir);
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

  async open_unhashed(name: string, options: Deno.OpenOptions): Promise<[Deno.FsFile, path: string]> {
    const path = `${this.cache_dir}/unhashed/${name}`;
    return [
      await Deno.open(path, options),
      path,
    ];
  }

  async write_at_unhashed(name: string, content: string): Promise<string> {
    const path = `${this.cache_dir}/unhashed/${name}`;
    await Deno.writeTextFile(path, content, { create: true });
    return path;
  }
}
