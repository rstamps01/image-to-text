import { invokeLLM } from "./_core/llm";

/**
 * Formatting structure returned by OCR
 */
export interface FormattingData {
  blocks: FormattingBlock[];
}

export interface FormattingBlock {
  type: "heading" | "paragraph" | "list" | "quote";
  level?: number; // For headings (1-6)
  content: string;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
  };
}

/**
 * OCR result with extracted text and metadata
 */
export interface OCRResult {
  extractedText: string;
  detectedPageNumber: string | null;
  formattingData: FormattingData;
  confidence: number;
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
  let prevValue = 0;

  for (let i = roman.length - 1; i >= 0; i--) {
    const currentValue = romanMap[roman[i]];
    if (!currentValue) return null;

    if (currentValue < prevValue) {
      result -= currentValue;
    } else {
      result += currentValue;
    }
    prevValue = currentValue;
  }

  return result;
}

/**
 * Extracts and normalizes page numbers from text
 * Handles Arabic numerals, Roman numerals, and various formats
 */
export function extractPageNumber(text: string): { pageNumber: string | null; sortOrder: number | null } {
  // Common page number patterns
  const patterns = [
    // Standalone numbers at start or end of line
    /^(\d+)$/m,
    /^[-–—]\s*(\d+)\s*[-–—]$/m,
    // Page X format
    /(?:page|pg\.?|p\.?)\s*(\d+)/i,
    // Roman numerals (i, ii, iii, iv, v, etc.)
    /^([ivxlcdm]+)$/im,
    // Numbers in brackets or parentheses
    /[\[\(](\d+)[\]\)]/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const captured = match[1].trim();

      // Check if it's a Roman numeral
      if (/^[ivxlcdm]+$/i.test(captured)) {
        const arabic = romanToArabic(captured.toUpperCase());
        if (arabic !== null) {
          return {
            pageNumber: captured,
            sortOrder: arabic,
          };
        }
      }

      // Check if it's an Arabic numeral
      const num = parseInt(captured, 10);
      if (!isNaN(num) && num > 0 && num < 10000) {
        return {
          pageNumber: captured,
          sortOrder: num,
        };
      }
    }
  }

  return { pageNumber: null, sortOrder: null };
}

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | unknown;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if it's a 500 error that we should retry
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is500Error = errorMessage.includes('500') || errorMessage.includes('Internal Server Error');
      
      if (!is500Error || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = initialDelay * Math.pow(2, attempt);
      console.log(`[OCR] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms due to upstream error`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Performs OCR on a book page image using vision LLM
 * Extracts text, detects page numbers, and preserves formatting
 * Includes automatic retry logic for temporary API failures
 */
export async function performOCR(imageUrl: string): Promise<OCRResult> {
  try {
    const systemPrompt = `You are an expert OCR system specialized in extracting text from book pages. Your task is to:

1. Extract ALL text from the image with perfect accuracy
2. Identify and extract the page number (if present) - it may be in Arabic numerals (1, 2, 3) or Roman numerals (i, ii, iii, iv, v)
3. Preserve the document structure and formatting including:
   - Headings and their hierarchy levels
   - Paragraphs
   - Lists (ordered and unordered)
   - Block quotes
   - Text formatting (bold, italic)

Return your response as a JSON object with this structure:
{
  "pageNumber": "detected page number or null if not found",
  "text": "complete extracted text",
  "confidence": 0-100 (integer representing your confidence in the OCR accuracy),
  "blocks": [
    {
      "type": "heading|paragraph|list|quote",
      "level": 1-6 (for headings only),
      "content": "text content",
      "formatting": {
        "bold": true/false,
        "italic": true/false
      }
    }
  ]
}

Be thorough and accurate. If you cannot detect a page number, set pageNumber to null.`;

    const response = await retryWithBackoff(() => invokeLLM({
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this book page image, detect the page number, and preserve formatting structure.",
            },
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
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ocr_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              pageNumber: {
                type: ["string", "null"],
                description: "The detected page number from the image, or null if not found",
              },
              text: {
                type: "string",
                description: "Complete extracted text from the page",
              },
              confidence: {
                type: "integer",
                description: "Confidence score (0-100) indicating OCR accuracy",
                minimum: 0,
                maximum: 100,
              },
              blocks: {
                type: "array",
                description: "Structured formatting blocks",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["heading", "paragraph", "list", "quote"],
                      description: "Type of content block",
                    },
                    level: {
                      type: ["integer", "null"],
                      description: "Heading level (1-6) for headings, null for other types",
                    },
                    content: {
                      type: "string",
                      description: "Text content of the block",
                    },
                    formatting: {
                      type: "object",
                      properties: {
                        bold: {
                          type: "boolean",
                          description: "Whether the text is bold",
                        },
                        italic: {
                          type: "boolean",
                          description: "Whether the text is italic",
                        },
                      },
                      required: ["bold", "italic"],
                      additionalProperties: false,
                    },
                  },
                  required: ["type", "content", "formatting"],
                  additionalProperties: false,
                },
              },
            },
            required: ["pageNumber", "text", "confidence", "blocks"],
            additionalProperties: false,
          },
        },
      },
    }));

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from LLM");
    }

    // Ensure content is a string
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const parsed = JSON.parse(contentStr);

    // Extract and normalize page number
    let detectedPageNumber = parsed.pageNumber;

    if (detectedPageNumber) {
      const extracted = extractPageNumber(detectedPageNumber);
      detectedPageNumber = extracted.pageNumber;
    } else {
      // Try to extract from the full text as fallback
      const extracted = extractPageNumber(parsed.text);
      detectedPageNumber = extracted.pageNumber;
    }

    return {
      extractedText: parsed.text,
      detectedPageNumber,
      formattingData: {
        blocks: parsed.blocks,
      },
      confidence: parsed.confidence / 100, // Convert 0-100 to 0-1
    };
  } catch (error) {
    console.error("[OCR] Error performing OCR:", error);
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
