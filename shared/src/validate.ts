// Compiled validators for consumers that do not get validation from Fastify (web app, tests).
import type { Static, TSchema } from 'typebox'
import { Compile } from 'typebox/compile'

export interface FieldError {
  /** JSON Pointer to the invalid value; empty string for the root. */
  path: string
  message: string
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] }

export function createValidator<S extends TSchema>(schema: S) {
  const compiled = Compile(schema)
  return (value: unknown): ValidationResult<Static<S>> =>
    compiled.Check(value)
      ? { ok: true, value: value as Static<S> }
      : {
          ok: false,
          errors: [...compiled.Errors(value)].map((e) => ({ path: e.instancePath, message: e.message })),
        }
}
