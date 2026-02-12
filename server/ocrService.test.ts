import { describe, expect, it } from "vitest";
import { extractPageNumber } from "./ocrService";

describe("extractPageNumber", () => {
  it("should extract Arabic numerals", () => {
    const result = extractPageNumber("42");
    expect(result.pageNumber).toBe("42");
    expect(result.sortOrder).toBe(42);
  });

  it("should extract page numbers with 'Page' prefix", () => {
    const result = extractPageNumber("Page 123");
    expect(result.pageNumber).toBe("123");
    expect(result.sortOrder).toBe(123);
  });

  it("should extract Roman numerals (lowercase)", () => {
    const result = extractPageNumber("iv");
    expect(result.pageNumber).toBe("iv");
    expect(result.sortOrder).toBe(4);
  });

  it("should extract Roman numerals (uppercase)", () => {
    const result = extractPageNumber("XII");
    expect(result.pageNumber).toBe("XII");
    expect(result.sortOrder).toBe(12);
  });

  it("should extract page numbers with dashes", () => {
    const result = extractPageNumber("- 56 -");
    expect(result.pageNumber).toBe("56");
    expect(result.sortOrder).toBe(56);
  });

  it("should extract page numbers in brackets", () => {
    const result = extractPageNumber("[78]");
    expect(result.pageNumber).toBe("78");
    expect(result.sortOrder).toBe(78);
  });

  it("should extract page numbers in parentheses", () => {
    const result = extractPageNumber("(99)");
    expect(result.pageNumber).toBe("99");
    expect(result.sortOrder).toBe(99);
  });

  it("should handle complex Roman numerals", () => {
    const testCases = [
      { input: "i", expected: 1 },
      { input: "ii", expected: 2 },
      { input: "iii", expected: 3 },
      { input: "iv", expected: 4 },
      { input: "v", expected: 5 },
      { input: "vi", expected: 6 },
      { input: "vii", expected: 7 },
      { input: "viii", expected: 8 },
      { input: "ix", expected: 9 },
      { input: "x", expected: 10 },
      { input: "xx", expected: 20 },
      { input: "xxx", expected: 30 },
      { input: "xl", expected: 40 },
      { input: "l", expected: 50 },
      { input: "xc", expected: 90 },
      { input: "c", expected: 100 },
    ];

    for (const testCase of testCases) {
      const result = extractPageNumber(testCase.input);
      expect(result.sortOrder).toBe(testCase.expected);
    }
  });

  it("should return null for text without page numbers", () => {
    const result = extractPageNumber("This is just regular text without any page number");
    expect(result.pageNumber).toBeNull();
    expect(result.sortOrder).toBeNull();
  });

  it("should return null for invalid numbers", () => {
    const result = extractPageNumber("Page abc");
    expect(result.pageNumber).toBeNull();
    expect(result.sortOrder).toBeNull();
  });

  it("should handle multiline text and extract page number", () => {
    const text = `
      Some content here
      Page 45
      More content
    `;
    const result = extractPageNumber(text);
    expect(result.pageNumber).toBe("45");
    expect(result.sortOrder).toBe(45);
  });

  it("should prioritize standalone numbers", () => {
    const result = extractPageNumber("123");
    expect(result.pageNumber).toBe("123");
    expect(result.sortOrder).toBe(123);
  });

  it("should reject unreasonably large page numbers", () => {
    const result = extractPageNumber("99999");
    expect(result.pageNumber).toBeNull();
    expect(result.sortOrder).toBeNull();
  });
});
