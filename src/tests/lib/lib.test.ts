import { describe, test, expect } from "bun:test";

import { Greet } from '../../lib';

describe("Lib", () => {
  test("should return the message", () => {
    const message = Greet('John');
    expect(message).toBe('Hello, John!');
  });
});
