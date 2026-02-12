import { invokeLLM } from "./_core/llm";

export interface FormattingBlock {
  type: 'paragraph' | 'heading' | 'list' | 'quote';
  content: string;
  level?: number;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    alignment?: 'left' | 'center' | 'right' | 'justify';
  };
}

interface FormattingData {
  blocks: FormattingBlock[];
}

interface OCRResult {
  extractedText: string;
  detectedPageNumber: string | null;
  formattingData: FormattingData;
  confidence: number;
}

/**
 * Cleans up common OCR artifacts from extracted text
 * Removes duplicate spaces, stray punctuation, and formatting inconsistencies
 * while preserving intentional formatting like indentation and line breaks
 */
export function cleanupOCRText(text: string): string {
  let cleaned = text;

  // Remove multiple consecutive spaces (but preserve single spaces)
  cleaned = cleaned.replace(/ {2,}/g, ' ');

  // Fix spacing around hyphens and dashes FIRST (before other rules)
  // Remove spaces around hyphens in compound words (e.g., "well - known" → "well-known")
  cleaned = cleaned.replace(/([a-zA-Z]) +- +([a-zA-Z])/g, '$1-$2');
  
  // Fix em-dashes with inconsistent spacing (standardize to no spaces)
  cleaned = cleaned.replace(/ +— +/g, '—');
  cleaned = cleaned.replace(/ +(--+) +/g, '—');
  
  // Fix spacing around slashes (e.g., "and / or" → "and/or") BEFORE stray character removal
  cleaned = cleaned.replace(/([a-zA-Z]) +\/ +([a-zA-Z])/g, '$1/$2');

  // Remove spaces before punctuation
  cleaned = cleaned.replace(/ +([.,;:!?])/g, '$1');

  // Remove spaces after opening parentheses/brackets
  cleaned = cleaned.replace(/([\[(]) +/g, '$1');
  
  // Remove spaces before closing parentheses/brackets
  cleaned = cleaned.replace(/ +([\])])/g, '$1');
  
  // Fix spacing around quotes (only remove internal spaces, preserve external)
  // Match quote + space + content + space + quote pattern
  cleaned = cleaned.replace(/(["]) +([^"]+?) +(["]) /g, '$1$2$3 ');
  cleaned = cleaned.replace(/ (["]) +([^"]+?) +(["]) /g, ' $1$2$3 ');
  cleaned = cleaned.replace(/ (["]) +([^"]+?) +(["]) /g, ' $1$2$3 ');
  
  // Fix common OCR character confusions
  // Note: Only apply obvious fixes to avoid changing intentional content
  cleaned = cleaned.replace(/\bl\b/g, 'I'); // Standalone 'l' likely means 'I'
  cleaned = cleaned.replace(/\b0(?=[A-Za-z])/g, 'O'); // '0' before letter likely 'O'
  
  // Fix common OCR punctuation errors
  // Replace multiple periods with ellipsis
  cleaned = cleaned.replace(/\.{4,}/g, '...');
  // Fix spaced ellipsis (e.g., ". . ." → "...")
  cleaned = cleaned.replace(/\. +\. +\./g, '...');
  
  // Remove stray single characters that are likely artifacts (except common single letters like 'a', 'I')
  // Exclude slash, dash, and em-dash from removal
  cleaned = cleaned.replace(/\b[^aAiI\s\d.,;:!?()\[\]{}"'\-\/—]\b/g, '');
  
  // Fix inconsistent spacing after periods
  // Ensure single space after period followed by capital letter (sentence boundary)
  cleaned = cleaned.replace(/\.  +([A-Z])/g, '. $1');
  
  // Fix spacing around colons (no space before, one space after)
  cleaned = cleaned.replace(/ +:( *)/g, ':$1');
  cleaned = cleaned.replace(/:([A-Za-z])/g, ': $1');
  
  // Clean up multiple consecutive line breaks (preserve paragraph breaks)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n');
  
  // Fix inconsistent line breaks in the middle of sentences
  // Join lines that end with lowercase and next line starts with lowercase
  cleaned = cleaned.replace(/([a-z,])\n([a-z])/g, '$1 $2');

  // Remove trailing spaces at end of lines
  cleaned = cleaned.replace(/ +$/gm, '');
  
  // Remove leading/trailing blank lines (but preserve internal structure)
  cleaned = cleaned.replace(/^\n+/, '').replace(/\n+$/, '');
  
  // Remove leading spaces at start of lines (1-3 spaces only, preserve 4+ for indentation)
  // This preserves intentional indentation while removing accidental leading spaces  
  cleaned = cleaned.split('\n').map(line => {
    // If line starts with 4+ spaces, keep all spaces (intentional indentation)
    if (line.match(/^ {4,}/)) {
      return line;
    }
    // Otherwise remove 1-3 leading spaces
    return line.replace(/^ {1,3}/, '');
  }).join('\n');

  return cleaned;
}

/**
 * Parses extracted text into structured FormattingBlock array
 */
function parseTextIntoBlocks(text: string): FormattingBlock[] {
  const blocks: FormattingBlock[] = [];
  const lines = text.split('\n');
  let currentParagraph: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      // If we have accumulated paragraph lines, save them
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          content: currentParagraph.join('\n'),
        });
        currentParagraph = [];
      }
      continue;
    }

    // Detect headings (all caps or title case with short length)
    const isAllCaps = /^[A-Z][A-Z\s\d]+$/.test(trimmedLine);
    const isShortAndBold = trimmedLine.length < 80 && /^[A-Z]/.test(trimmedLine);
    
    if (isAllCaps && trimmedLine.length < 100) {
      // Save any accumulated paragraph
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          content: currentParagraph.join('\n'),
        });
        currentParagraph = [];
      }
      
      // Add as heading
      blocks.push({
        type: 'heading',
        content: trimmedLine,
        level: 1,
        formatting: { bold: true },
      });
    } else if (isShortAndBold && (trimmedLine.startsWith('Section') || trimmedLine.startsWith('Article') || trimmedLine.startsWith('Chapter'))) {
      // Save any accumulated paragraph
      if (currentParagraph.length > 0) {
        blocks.push({
          type: 'paragraph',
          content: currentParagraph.join('\n'),
        });
        currentParagraph = [];
      }
      
      // Add as heading
      blocks.push({
        type: 'heading',
        content: trimmedLine,
        level: 2,
        formatting: { bold: true },
      });
    } else {
      // Regular paragraph line
      currentParagraph.push(line);
    }
  }

  // Add any remaining paragraph
  if (currentParagraph.length > 0) {
    blocks.push({
      type: 'paragraph',
      content: currentParagraph.join('\n'),
    });
  }

  return blocks;
}

/**
 * Converts Roman numerals to Arabic numbers
 */
function romanToArabic(roman: string): number | null {
  const romanMap: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let result = 0;
  for (let i = 0; i < roman.length; i++) {
    const current = romanMap[roman[i]];
    const next = romanMap[roman[i + 1]];

    if (next && current < next) {
      result -= current;
    } else {
      result += current;
    }
  }

  return result;
}

/**
 * Extracts page number from text using LLM
 */
async function extractPageNumber(text: string): Promise<string | null> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You are a page number detector. Extract the page number from the given text.
Look for:
- Arabic numerals (1, 2, 3, etc.)
- Roman numerals (i, ii, iii, iv, v, etc. or I, II, III, IV, V, etc.)
- Page indicators like "Page 5" or "- 5 -"

Return ONLY the page number (e.g., "5" or "iii" or "IV"). If no page number is found, return "null".`,
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    const pageNumber = typeof content === 'string' ? content.trim() : null;
    return pageNumber === "null" ? null : pageNumber;
  } catch (error) {
    console.error("[OCR] Failed to extract page number:", error);
    return null;
  }
}

/**
 * Performs OCR on an image using vision LLM
 */
export async function performOCR(imageUrl: string): Promise<OCRResult> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an OCR system that extracts text from book page images with high accuracy.

CRITICAL EXTRACTION RULES:
1. Extract EVERY SINGLE LINE of text visible in the image - do not skip or truncate
2. For Table of Contents pages: Extract ALL sections from top to bottom, not just the first few
3. Continue extraction until you reach the bottom of the visible page
4. If you see "Section 3.17" through "Section 4.12", extract ALL of them, not just 3.17-3.19

FORMATTING RULES:
1. Preserve the EXACT line-by-line structure of the original image
2. Each line in your output must start and end with the SAME words as in the image
3. Maintain all indentation, spacing, and paragraph breaks EXACTLY as shown
4. Do NOT add or remove line breaks - match the image precisely
5. Preserve justified text alignment and spacing between words

SPECIAL HANDLING:
- Table of Contents: Recognize the structure with section titles and page numbers
- DO NOT include dotted leaders (....) between titles and page numbers
- Extract ALL section titles and their corresponding page numbers (not just the first few)
- Preserve the hierarchical indentation of sections and subsections
- Continue extracting until the end of the page

OUTPUT FORMAT:
- Return ONLY the extracted text
- Maintain exact line breaks and indentation from the image
- Do not add explanations, metadata, or formatting markers
- Each line should mirror the original image's line structure
- Extract the COMPLETE page content from top to bottom`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                  detail: "high",
                },
              },
            ],
          },
        ],
      });

      const extractedText = typeof response.choices[0]?.message?.content === 'string' 
        ? response.choices[0].message.content 
        : "";
      const confidence = 0.98; // High confidence for LLM-based OCR

      // Extract page number
      const detectedPageNumber = await extractPageNumber(extractedText);

      // Parse text into structured blocks
      const blocks = parseTextIntoBlocks(extractedText);

      return {
        extractedText,
        detectedPageNumber,
        formattingData: {
          blocks,
        },
        confidence,
      };
    } catch (error: any) {
      const isUpstreamError = error?.message?.includes("upstream") || 
                              error?.message?.includes("502") || 
                              error?.message?.includes("503") ||
                              error?.message?.includes("504");

      if (isUpstreamError && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[OCR] Retry attempt ${attempt}/${maxRetries} after ${delay}ms due to upstream error`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error("[OCR] Failed to perform OCR:", error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  throw new Error("OCR processing failed after maximum retries");
}
