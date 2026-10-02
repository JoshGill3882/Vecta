import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library only auto-cleans when Vitest runs with globals enabled, and
// this suite imports its helpers explicitly instead. Without this, each render
// stays in the document and the next `getBy*` query finds two of everything.
afterEach(cleanup);

// jsdom has no `matchMedia`, which every real browser does. Answer every query
// with "no match" - a mouse, a wide screen, no reduced motion - so components
// that ask render their default version. A test about another answer stubs
// its own with `vi.stubGlobal`, which `vi.unstubAllGlobals` puts back to this.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) satisfies MediaQueryList;
