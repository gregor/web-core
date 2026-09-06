// Re-exports the ambient types apps need but no longer depend on directly.
//
// Apps do not depend on vite or the testing libraries — web-core owns them — so
// `vite/client` is only resolvable if npm happens to hoist vite to the app root,
// and it does not always: in web-todo npm nested vite under this package instead,
// which broke typecheck while the build kept working. Resolving these references
// from inside web-core, where the packages are real dependencies, works either way.
/// <reference types="vite/client" />
/// <reference types="@testing-library/jest-dom/vitest" />
