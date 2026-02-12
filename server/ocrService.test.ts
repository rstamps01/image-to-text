import { describe, expect, it } from "vitest";
import { cleanupOCRText } from "./ocrService";

describe("cleanupOCRText", () => {
  it("should remove multiple consecutive spaces", () => {
    const input = "This  has   multiple    spaces";
    const result = cleanupOCRText(input);
    expect(result).toBe("This has multiple spaces");
  });

  it("should remove spaces before punctuation", () => {
    const input = "Hello , world ! How are you ?";
    const result = cleanupOCRText(input);
    expect(result).toBe("Hello, world! How are you?");
  });

  it("should remove spaces after opening brackets", () => {
    const input = "( text in parentheses ) and [ text in brackets ]";
    const result = cleanupOCRText(input);
    expect(result).toBe("(text in parentheses) and [text in brackets]");
  });

  it("should fix spacing around hyphens in compound words", () => {
    const input = "well - known and state - of - the - art";
    const result = cleanupOCRText(input);
    expect(result).toBe("well-known and state-of-the-art");
  });

  it("should standardize em-dashes", () => {
    const input = "Text before — text after and text -- more text";
    const result = cleanupOCRText(input);
    expect(result).toBe("Text before—text after and text—more text");
  });

  it("should fix spacing around quotes", () => {
    const input = "He said \" hello \" to me";
    const result = cleanupOCRText(input);
    expect(result).toBe("He said \"hello\" to me");
  });

  it("should fix spacing around slashes", () => {
    const input = "and / or but / however";
    const result = cleanupOCRText(input);
    expect(result).toBe("and/or but/however");
  });

  it("should fix standalone 'l' to 'I'", () => {
    const input = "l think this is correct";
    const result = cleanupOCRText(input);
    expect(result).toBe("I think this is correct");
  });

  it("should fix '0' before letters to 'O'", () => {
    const input = "0ctober and 0peration";
    const result = cleanupOCRText(input);
    expect(result).toBe("October and Operation");
  });

  it("should replace multiple periods with ellipsis", () => {
    const input = "Wait.... for it";
    const result = cleanupOCRText(input);
    expect(result).toBe("Wait... for it");
  });

  it("should fix spaced ellipsis", () => {
    const input = "Wait . . . for it";
    const result = cleanupOCRText(input);
    expect(result).toBe("Wait... for it");
  });

  it("should fix inconsistent spacing after periods", () => {
    const input = "First sentence.  Second sentence.   Third sentence.";
    const result = cleanupOCRText(input);
    expect(result).toBe("First sentence. Second sentence. Third sentence.");
  });

  it("should fix spacing around colons", () => {
    const input = "Title :Content and Another :More";
    const result = cleanupOCRText(input);
    expect(result).toBe("Title: Content and Another: More");
  });

  it("should join lines that break mid-sentence", () => {
    const input = "This is a sentence that breaks\nin the middle";
    const result = cleanupOCRText(input);
    expect(result).toBe("This is a sentence that breaks in the middle");
  });

  it("should remove trailing spaces at end of lines", () => {
    const input = "Line one   \nLine two  \nLine three";
    const result = cleanupOCRText(input);
    expect(result).toBe("Line one\nLine two\nLine three");
  });

  it("should remove leading spaces (1-3) at start of lines", () => {
    const input = "  Line one\n Line two\n   Line three";
    const result = cleanupOCRText(input);
    expect(result).toBe("Line one\nLine two\nLine three");
  });

  it("should remove excessive indentation from OCR text", () => {
    const input = "Normal line\n    Indented line\n        More indented";
    const result = cleanupOCRText(input);
    // OCR cleanup should remove indentation as it's usually an artifact
    expect(result).toBe("Normal line\nIndented line\nMore indented");
  });

  it("should handle complex real-world text", () => {
    const input = `ARTICLE  l
REPRESENTATIONS  AND  WARRANTIES  OF  THE  COMPANY
The  Company  ( as  defined  in  the  Schedule  A ) , as  a  material  inducement  to  Parent  and  Merger  Sub  to
enter  into  this  Agreement  and  to  consummate  the  transactions  contemplated  hereby , the  Company
hereby  represents  and  warranties  to  Parent  and  Merger  Sub  as  follows :`;
    
    const result = cleanupOCRText(input);
    
    // Should remove extra spaces between words
    expect(result).not.toContain("  ");
    // Should fix standalone 'l' to 'I'
    expect(result).toContain("ARTICLE I");
    // Should have proper spacing after punctuation
    expect(result).toContain("Company (as defined");
    expect(result).toContain("Schedule A),");
  });

  it("should trim leading and trailing whitespace", () => {
    const input = "  \n  Text with whitespace  \n  ";
    const result = cleanupOCRText(input);
    expect(result).toBe("Text with whitespace");
  });
});
