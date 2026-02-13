import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import MarkdownIt from "markdown-it";
import { Page } from "../drizzle/schema";
import { FormattingBlock } from "./ocrService";

/**
 * Extracts content for a formatting block from the full text using line indices
 */
function getBlockContent(text: string, block: FormattingBlock): string {
  const lines = text.split('\n');
  return lines.slice(block.startLine, block.endLine + 1).join('\n');
}

/**
 * Export format options
 */
export type ExportFormat = "md" | "txt" | "pdf" | "docx";

/**
 * Converts pages to Markdown format
 */
export function exportToMarkdown(pages: Page[]): string {
  let markdown = "";

  for (const page of pages) {
    if (!page.extractedText) continue;

    // Add page separator with page number if available
    if (page.detectedPageNumber) {
      markdown += `\n---\n**Page ${page.detectedPageNumber}**\n\n`;
    } else {
      markdown += `\n---\n\n`;
    }

    // Use formatting data if available
    if (page.formattingData && typeof page.formattingData === "object") {
      const formattingData = page.formattingData as { blocks: FormattingBlock[] };
      
      for (const block of formattingData.blocks) {
        const blockContent = getBlockContent(page.extractedText, block);
        
        switch (block.type) {
          case "heading":
            const level = block.level || 1;
            markdown += `${"#".repeat(level)} ${blockContent}\n\n`;
            break;
          case "list":
            markdown += `- ${blockContent}\n`;
            break;
          case "quote":
            markdown += `> ${blockContent}\n\n`;
            break;
          case "paragraph":
          default:
            let content = blockContent;
            if (block.formatting?.bold) {
              content = `**${content}**`;
            }
            if (block.formatting?.italic) {
              content = `*${content}*`;
            }
            markdown += `${content}\n\n`;
            break;
        }
      }
    } else {
      // Fallback to plain text
      markdown += `${page.extractedText}\n\n`;
    }
  }

  return markdown.trim();
}

/**
 * Converts pages to plain text format
 */
export function exportToText(pages: Page[]): string {
  let text = "";

  for (const page of pages) {
    if (!page.extractedText) continue;

    // Add page separator with page number if available
    if (page.detectedPageNumber) {
      text += `\n${"=".repeat(50)}\nPage ${page.detectedPageNumber}\n${"=".repeat(50)}\n\n`;
    } else {
      text += `\n${"=".repeat(50)}\n\n`;
    }

    text += `${page.extractedText}\n\n`;
  }

  return text.trim();
}

/**
 * Converts pages to PDF format
 */
export async function exportToPDF(pages: Page[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 595; // A4 width in points
  const pageHeight = 842; // A4 height in points
  const margin = 50;
  const maxWidth = pageWidth - 2 * margin;

  for (const pageData of pages) {
    if (!pageData.extractedText) continue;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;

    // Add page number header if available
    if (pageData.detectedPageNumber) {
      page.drawText(`Page ${pageData.detectedPageNumber}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5),
      });
      yPosition -= 30;
    }

    // Process formatting blocks if available
    if (pageData.formattingData && typeof pageData.formattingData === "object") {
      const formattingData = pageData.formattingData as { blocks: FormattingBlock[] };

      for (const block of formattingData.blocks) {
        const blockContent = getBlockContent(pageData.extractedText, block);
        let fontSize = 12;
        let currentFont = font;

        // Determine font and size based on block type
        if (block.type === "heading") {
          fontSize = 18 - (block.level || 1) * 2;
          currentFont = boldFont;
        } else if (block.formatting?.bold) {
          currentFont = boldFont;
        } else if (block.formatting?.italic) {
          currentFont = italicFont;
        }

        // Split content by newlines first, then word wrap each line
        const contentLines = blockContent.split(/\r?\n/);
        
        for (const contentLine of contentLines) {
          // Word wrap text for each line
          const words = contentLine.split(" ");
          let line = "";

          for (const word of words) {
            const testLine = line + (line ? " " : "") + word;
            const textWidth = currentFont.widthOfTextAtSize(testLine, fontSize);

            if (textWidth > maxWidth && line) {
              // Draw current line
              if (yPosition < margin + fontSize) {
                // Need new page
                page = pdfDoc.addPage([pageWidth, pageHeight]);
                yPosition = pageHeight - margin;
              }

              page.drawText(line, {
                x: margin,
                y: yPosition,
                size: fontSize,
                font: currentFont,
                color: rgb(0, 0, 0),
              });

              yPosition -= fontSize + 5;
              line = word;
            } else {
              line = testLine;
            }
          }

          // Draw remaining text
          if (line) {
            if (yPosition < margin + fontSize) {
              page = pdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - margin;
            }

            page.drawText(line, {
              x: margin,
              y: yPosition,
              size: fontSize,
              font: currentFont,
              color: rgb(0, 0, 0),
            });

            yPosition -= fontSize + 5;
          }
        }

        // Add spacing after block
        yPosition -= block.type === "heading" ? 10 : 5;
      }
    } else {
      // Fallback to plain text rendering
      const lines = pageData.extractedText.split("\n");

      for (const line of lines) {
        if (yPosition < margin + 12) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }

        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        });

        yPosition -= 17;
      }
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Converts pages to DOCX format
 */
export async function exportToDOCX(pages: Page[]): Promise<Buffer> {
  const docParagraphs: Paragraph[] = [];

  for (const pageData of pages) {
    if (!pageData.extractedText) continue;

    // Add page number header if available
    if (pageData.detectedPageNumber) {
      docParagraphs.push(
        new Paragraph({
          text: `Page ${pageData.detectedPageNumber}`,
          spacing: { before: 200, after: 100 },
          alignment: AlignmentType.CENTER,
          style: "Normal",
        })
      );
    }

    // Process formatting blocks if available
    if (pageData.formattingData && typeof pageData.formattingData === "object") {
      const formattingData = pageData.formattingData as { blocks: FormattingBlock[] };

      for (const block of formattingData.blocks) {
        const blockContent = getBlockContent(pageData.extractedText, block);
        let heading: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined;
        const textRuns: TextRun[] = [];

        if (block.type === "heading") {
          const level = block.level || 1;
          heading = [
            HeadingLevel.HEADING_1,
            HeadingLevel.HEADING_2,
            HeadingLevel.HEADING_3,
            HeadingLevel.HEADING_4,
            HeadingLevel.HEADING_5,
            HeadingLevel.HEADING_6,
          ][level - 1] || HeadingLevel.HEADING_1;
        }

        textRuns.push(
          new TextRun({
            text: blockContent,
            bold: block.formatting?.bold || block.type === "heading",
            italics: block.formatting?.italic,
          })
        );

        docParagraphs.push(
          new Paragraph({
            children: textRuns,
            heading,
            spacing: { before: 100, after: 100 },
            bullet: block.type === "list" ? { level: 0 } : undefined,
          })
        );
      }
    } else {
      // Fallback to plain text
      const lines = pageData.extractedText.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          docParagraphs.push(
            new Paragraph({
              text: line,
              spacing: { before: 50, after: 50 },
            })
          );
        }
      }
    }

    // Add page break after each page (except the last one)
    if (pageData !== pages[pages.length - 1]) {
      docParagraphs.push(
        new Paragraph({
          text: "",
          pageBreakBefore: true,
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docParagraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

/**
 * Main export function that routes to the appropriate format handler
 */
export async function exportDocument(pages: Page[], format: ExportFormat): Promise<Buffer | string> {
  // Sort pages by sortOrder
  const sortedPages = [...pages].sort((a, b) => {
    if (a.sortOrder === null && b.sortOrder === null) return 0;
    if (a.sortOrder === null) return 1;
    if (b.sortOrder === null) return -1;
    return a.sortOrder - b.sortOrder;
  });

  switch (format) {
    case "md":
      return exportToMarkdown(sortedPages);
    case "txt":
      return exportToText(sortedPages);
    case "pdf":
      return await exportToPDF(sortedPages);
    case "docx":
      return await exportToDOCX(sortedPages);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}
