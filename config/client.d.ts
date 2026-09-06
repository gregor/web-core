// Re-exports vite's client types (import.meta.env, CSS side-effect imports, asset
// modules) so apps do not have to reference `vite/client` directly.
//
// Apps no longer depend on vite, so `vite/client` is only resolvable if npm happens
// to hoist vite to the app's top-level node_modules — and it does not always: in
// web-todo npm nested vite under this package instead, which broke typecheck while
// the build kept working. Resolving the reference from inside web-core, where vite
// is a real dependency, works either way.
/// <reference types="vite/client" />
