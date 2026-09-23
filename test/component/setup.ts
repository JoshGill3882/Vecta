import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library only auto-cleans when Vitest runs with globals enabled, and
// this suite imports its helpers explicitly instead. Without this, each render
// stays in the document and the next `getBy*` query finds two of everything.
afterEach(cleanup);
