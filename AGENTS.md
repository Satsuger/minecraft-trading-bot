# Agent Instructions

These instructions apply to the whole repository.

## General

- Follow the existing TypeScript style already present in the repo.
- Prefer small, explicit classes and services with one clear responsibility.
- Do not introduce `debugger` statements or temporary logging unless explicitly requested.
- Do not import files through `node_modules/...` paths. Use package imports or relative imports.

## Formatting

- Use double quotes.
- Keep semicolons.
- Prefer early returns over nested conditionals.
- If a guard clause fits on one line, keep it on one line.

Example:

```ts
if (!this.ordersService) return;
if (!window) return null;
```

- If the branch contains more than one statement, use braces.

Example:

```ts
if (!this.bot) {
  throw new Error("Bot has not been started yet");
}
```

## Services

- Services should have a single responsibility.
- Transport-layer services should send commands or perform I/O, but not own business interpretation.
- Business-layer services should call lower-level services and return normalized objects.
- Do not couple new services directly into runtime entrypoints unless the task explicitly asks for integration.

## Shared Code

- Put reusable enums, contracts, and cross-app types in `libs/shared`.
- If a value is shared between backend and frontend, do not duplicate it in app code.

## Changes

- Keep diffs focused.
- Match existing naming unless there is a clear improvement.
- Prefer extending current patterns over introducing a new pattern for one file.
