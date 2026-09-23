import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

/*
 * A canary for the component project's toolchain rather than a test of any
 * component.
 *
 * The JSX here is transformed by esbuild reading `jsx: "react-jsx"` out of
 * tsconfig, with no React plugin in the Vite config. That is a deliberate
 * choice — see docs/guides/testing.md — and it is the kind of thing that breaks
 * quietly on a toolchain upgrade. When it does, this fails with an obvious
 * message instead of a real spec failing for a reason that looks like its own.
 */
describe("component test environment", () => {
  it("transforms JSX and renders it into a DOM", () => {
    render(<h1>rendered</h1>);
    expect(screen.getByRole("heading", { name: "rendered" })).toBeDefined();
  });

  it("provides the browser globals a component may reach for", () => {
    expect(typeof document).toBe("object");
    expect(typeof window.localStorage.getItem).toBe("function");
  });
});
