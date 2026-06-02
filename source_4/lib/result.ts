export function assert(expr: unknown, msg?: string): asserts expr {
  if (!expr) throw new Error(msg ?? "failed assertion")
}

export type Result<V, E> =
  | { tag: "ok", val: V, get_val(): V, get_error(): never }
  | { tag: "err", error: E, get_val(): never, get_error(): E } ;

export function ok<V, E>(val: V): Result<V, E> {
  return {
    tag: "ok",
    val: val,
    get_val() {
      assert(this.tag === "ok");
      return this.val;
    },
    get_error() {
      assert(false);
    }
  };
}

export function error<V, E>(error: E): Result<V, E> {
  return {
    tag: "err",
    error: error,
    get_val() {
      assert(false);
    },
    get_error() {
      assert(this.tag === "err");
      return this.error;
    }
  };
}

