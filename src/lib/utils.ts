/**
 * The `cn` entry point every component imports as `@/lib/utils` — the path
 * shadcn's CLI writes into generated files (components.json `aliases.utils`).
 * The merge engine itself is the upstream `cn` package; this module exists so
 * the project has one import specifier to change if the engine is ever swapped.
 */
export { cn } from 'cn';
