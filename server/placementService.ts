/**
 * Intelligent page placement service
 * Determines where new pages should be inserted in an existing project
 * based on page numbers, filenames, and metadata
 */

interface PlacementResult {
  sortOrder: number;
  confidence: number; // 0-100
  needsValidation: "yes" | "no";
  reason: string;
}

interface ExistingPage {
  id: number;
  sortOrder: number | null;
  detectedPageNumber: string | null;
  filename: string;
}

/**
 * Extract numeric value from page number string (handles Roman numerals and Arabic)
 */
function parsePageNumber(pageNum: string | null): number | null {
  if (!pageNum) return null;

  // Try parsing as integer first
  const arabicNum = parseInt(pageNum, 10);
  if (!isNaN(arabicNum)) return arabicNum;

  // Handle Roman numerals
  const romanMap: Record<string, number> = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000
  };

  const roman = pageNum.toUpperCase().trim();
  let result = 0;
  let prevValue = 0;

  for (let i = roman.length - 1; i >= 0; i--) {
    const currentValue = romanMap[roman[i]];
    if (!currentValue) return null; // Invalid Roman numeral

    if (currentValue < prevValue) {
      result -= currentValue;
    } else {
      result += currentValue;
    }
    prevValue = currentValue;
  }

  return result > 0 ? result : null;
}

/**
 * Extract page number from filename (e.g., "page_5.jpg", "scan-023.png", "IMG_0042.jpg")
 */
function extractPageNumberFromFilename(filename: string): number | null {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

  // Try to find numeric patterns
  const patterns = [
    /page[_\s-]*(\d+)/i,     // page_5, page-5, page 5
    /scan[_\s-]*(\d+)/i,     // scan_023, scan-023
    /img[_\s-]*(\d+)/i,      // IMG_0042
    /(\d+)$/,                 // ending with numbers
    /^(\d+)/,                 // starting with numbers
  ];

  for (const pattern of patterns) {
    const match = nameWithoutExt.match(pattern);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) return num;
    }
  }

  return null;
}

/**
 * Determine where to place a new page in the project
 */
export function determinePlacement(
  newPageNumber: string | null,
  newFilename: string,
  existingPages: ExistingPage[]
): PlacementResult {
  // If no existing pages, place at the beginning
  if (existingPages.length === 0) {
    return {
      sortOrder: 1,
      confidence: 100,
      needsValidation: "no",
      reason: "First page in project",
    };
  }

  // Sort existing pages by sortOrder
  const sortedPages = [...existingPages].sort((a, b) => {
    const aOrder = a.sortOrder ?? 999999;
    const bOrder = b.sortOrder ?? 999999;
    return aOrder - bOrder;
  });

  // Try to use detected page number first
  const newPageNum = parsePageNumber(newPageNumber);
  
  if (newPageNum !== null) {
    // Find where this page number fits in the sequence
    let insertPosition = sortedPages.length + 1;
    let confidence = 90;

    for (let i = 0; i < sortedPages.length; i++) {
      const existingPageNum = parsePageNumber(sortedPages[i].detectedPageNumber);
      
      if (existingPageNum !== null) {
        if (newPageNum < existingPageNum) {
          insertPosition = sortedPages[i].sortOrder ?? i + 1;
          confidence = 95;
          break;
        } else if (newPageNum === existingPageNum) {
          // Duplicate page number - needs validation
          return {
            sortOrder: (sortedPages[i].sortOrder ?? i + 1) + 0.5, // Place after duplicate
            confidence: 50,
            needsValidation: "yes",
            reason: `Duplicate page number ${newPageNumber} detected. Please verify placement.`,
          };
        }
      }
    }

    return {
      sortOrder: insertPosition,
      confidence,
      needsValidation: confidence < 80 ? "yes" : "no",
      reason: `Placed based on detected page number: ${newPageNumber}`,
    };
  }

  // Fallback: Try to extract page number from filename
  const filenamePageNum = extractPageNumberFromFilename(newFilename);
  
  if (filenamePageNum !== null) {
    let insertPosition = sortedPages.length + 1;
    let confidence = 70;

    for (let i = 0; i < sortedPages.length; i++) {
      const existingFilenameNum = extractPageNumberFromFilename(sortedPages[i].filename);
      const existingPageNum = parsePageNumber(sortedPages[i].detectedPageNumber);
      
      const existingNum = existingPageNum ?? existingFilenameNum;
      
      if (existingNum !== null && filenamePageNum < existingNum) {
        insertPosition = sortedPages[i].sortOrder ?? i + 1;
        confidence = 75;
        break;
      }
    }

    return {
      sortOrder: insertPosition,
      confidence,
      needsValidation: "yes",
      reason: `Placed based on filename pattern. No page number detected in image. Please verify placement.`,
    };
  }

  // Last resort: Place at the end
  const lastPage = sortedPages[sortedPages.length - 1];
  const lastOrder = lastPage.sortOrder ?? sortedPages.length;

  return {
    sortOrder: lastOrder + 1,
    confidence: 30,
    needsValidation: "yes",
    reason: `No page number or filename pattern detected. Placed at end. Please verify placement.`,
  };
}

/**
 * Reorder existing pages after inserting a new page
 * This ensures sortOrder values remain sequential
 */
export function reorderPages(
  pages: ExistingPage[],
  newPageSortOrder: number
): Map<number, number> {
  const updates = new Map<number, number>();
  
  const sortedPages = [...pages].sort((a, b) => {
    const aOrder = a.sortOrder ?? 999999;
    const bOrder = b.sortOrder ?? 999999;
    return aOrder - bOrder;
  });

  let currentOrder = 1;
  
  for (const page of sortedPages) {
    const originalOrder = page.sortOrder ?? currentOrder;
    
    // If we've reached the insertion point, skip one number
    if (currentOrder === Math.floor(newPageSortOrder)) {
      currentOrder++;
    }
    
    // Only update if the order changed
    if (currentOrder !== originalOrder) {
      updates.set(page.id, currentOrder);
    }
    
    currentOrder++;
  }

  return updates;
}
