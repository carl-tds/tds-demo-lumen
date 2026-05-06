// Loaded only by the jsdom test project (see vitest.config.ts).
// Adds custom matchers like toBeInTheDocument().
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest 4 + RTL16 with globals:false does not auto-register cleanup, so we
// register it here. Without this, every render() across tests in the same file
// stacks DOM nodes and getByRole sees duplicates.
afterEach(() => {
  cleanup();
});
