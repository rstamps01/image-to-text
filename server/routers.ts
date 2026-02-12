import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createProject,
  getProjectById,
  getProjectsByUserId,
  updateProject,
  deleteProject,
  createPage,
  getPageById,
  getPagesByProjectId,
  updatePage,
  updatePageStatus,
} from "./db";
import { storagePut } from "./storage";
import { performOCR, cleanupOCRText } from "./ocrService";
import { exportDocument, ExportFormat } from "./exportService";
import { nanoid } from "nanoid";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  projects: router({
    // Create a new project
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(255),
          description: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await createProject({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
        });
        return project;
      }),

    // Get all projects for current user
    list: protectedProcedure.query(async ({ ctx }) => {
      return getProjectsByUserId(ctx.user.id);
    }),

    // Get a specific project with its pages
    get: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const pages = await getPagesByProjectId(input.projectId);
        return { project, pages };
      }),

    // Delete a project
    delete: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        await deleteProject(input.projectId);
        return { success: true };
      }),

    // Bulk delete projects
    bulkDelete: protectedProcedure
      .input(z.object({ projectIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        let deletedCount = 0;
        const errors: string[] = [];

        for (const projectId of input.projectIds) {
          try {
            const project = await getProjectById(projectId);
            if (!project) {
              errors.push(`Project ${projectId} not found`);
              continue;
            }
            if (project.userId !== ctx.user.id) {
              errors.push(`Unauthorized to delete project ${projectId}`);
              continue;
            }

            await deleteProject(projectId);
            deletedCount++;
          } catch (error) {
            errors.push(`Failed to delete project ${projectId}: ${error}`);
          }
        }

        return { deletedCount, errors, success: deletedCount > 0 };
      }),

    // Update project status
    updateStatus: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          status: z.enum(["uploading", "processing", "completed", "failed"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        await updateProject(input.projectId, { status: input.status });
        return { success: true };
      }),

    // Update project settings (cleanup toggle, etc.)
    updateSettings: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          enableCleanup: z.enum(["yes", "no"]).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const updates: any = {};
        if (input.enableCleanup !== undefined) {
          updates.enableCleanup = input.enableCleanup;
        }

        await updateProject(input.projectId, updates);
        return { success: true };
      }),
  }),

  pages: router({
    // Upload a page image and create page record
    upload: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          filename: z.string(),
          imageData: z.string(), // Base64 encoded image
          mimeType: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Convert base64 to buffer
        const base64Data = input.imageData.split(",")[1] || input.imageData;
        const buffer = Buffer.from(base64Data, "base64");

        // Upload to S3
        const fileKey = `projects/${input.projectId}/pages/${nanoid()}-${input.filename}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // Create page record
        const page = await createPage({
          projectId: input.projectId,
          filename: input.filename,
          imageKey: fileKey,
          imageUrl: url,
          status: "pending",
        });

        // Update project total pages count
        await updateProject(input.projectId, {
          totalPages: project.totalPages + 1,
        });

        return page;
      }),

    // Process OCR for a page
    processOCR: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const page = await getPageById(input.pageId);
        
        if (!page) {
          throw new Error("Page not found");
        }

        const project = await getProjectById(page.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        try {
          // Update status to processing
          await updatePageStatus(input.pageId, "processing");

          // Perform OCR
          const ocrResult = await performOCR(page.imageUrl);

          // Apply cleanup if enabled for this project
          const extractedText = project.enableCleanup === 'yes' 
            ? cleanupOCRText(ocrResult.extractedText)
            : ocrResult.extractedText;

          // Update page with OCR results
          await updatePage(input.pageId, {
            extractedText,
            detectedPageNumber: ocrResult.detectedPageNumber,
            formattingData: ocrResult.formattingData as any,
            confidenceScore: Math.round(ocrResult.confidence * 100), // Convert 0-1 to 0-100
            status: "completed",
          });

          // Update project processed pages count
          await updateProject(page.projectId, {
            processedPages: project.processedPages + 1,
          });

          return {
            success: true,
            pageNumber: ocrResult.detectedPageNumber,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "OCR processing failed";
          await updatePageStatus(input.pageId, "failed", errorMessage);
          throw error;
        }
      }),

    // Reorder pages based on detected page numbers
    reorder: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const pages = await getPagesByProjectId(input.projectId);

        // Sort pages by detected page number
        const sortedPages = [...pages].sort((a, b) => {
          // Pages with detected numbers come first
          if (a.detectedPageNumber && !b.detectedPageNumber) return -1;
          if (!a.detectedPageNumber && b.detectedPageNumber) return 1;
          if (!a.detectedPageNumber && !b.detectedPageNumber) {
            // If neither has page number, sort by upload order (id)
            return a.id - b.id;
          }

          // Both have page numbers - extract numeric values
          const aNum = parseInt(a.detectedPageNumber!, 10);
          const bNum = parseInt(b.detectedPageNumber!, 10);

          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }

          // Fallback to string comparison
          return a.detectedPageNumber!.localeCompare(b.detectedPageNumber!);
        });

        // Update sort order for each page
        for (let i = 0; i < sortedPages.length; i++) {
          await updatePage(sortedPages[i].id, { sortOrder: i });
        }

        return { success: true };
      }),

    // Manual reorder - update sort order for specific pages
    updateOrder: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          pageOrders: z.array(
            z.object({
              pageId: z.number(),
              sortOrder: z.number(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Update each page's sort order
        for (const { pageId, sortOrder } of input.pageOrders) {
          await updatePage(pageId, { sortOrder });
        }

        return { success: true };
      }),

    // Retry all failed pages in a project
    retryFailed: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const pages = await getPagesByProjectId(input.projectId);
        const failedPages = pages.filter(p => p.status === "failed");

        if (failedPages.length === 0) {
          return { success: true, retriedCount: 0, results: [] };
        }

        const results: Array<{ pageId: number; success: boolean; error?: string }> = [];

        for (const page of failedPages) {
          try {
            // Reset status to processing
            await updatePageStatus(page.id, "processing");

            // Perform OCR
            const ocrResult = await performOCR(page.imageUrl);

            // Update page with OCR results
            await updatePage(page.id, {
              extractedText: ocrResult.extractedText,
              detectedPageNumber: ocrResult.detectedPageNumber,
              formattingData: ocrResult.formattingData as any,
              status: "completed",
              errorMessage: null,
            });

            results.push({ pageId: page.id, success: true });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "OCR processing failed";
            await updatePage(page.id, {
              status: "failed",
              errorMessage,
            });
            results.push({ pageId: page.id, success: false, error: errorMessage });
          }
        }

        // Update project processed pages count
        const successCount = results.filter(r => r.success).length;
        if (successCount > 0) {
          await updateProject(input.projectId, {
            processedPages: project.processedPages + successCount,
          });
        }

        return {
          success: true,
          retriedCount: failedPages.length,
          successCount,
          results,
        };
      }),

    // Retry a single failed page
    retrySingle: protectedProcedure
      .input(z.object({ pageId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const page = await getPageById(input.pageId);
        if (!page) {
          throw new Error("Page not found");
        }

        const project = await getProjectById(page.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        if (page.status !== "failed" && page.status !== "pending") {
          throw new Error("Only failed or pending pages can be processed");
        }

        try {
          // Reset status to processing
          await updatePageStatus(input.pageId, "processing");

          // Perform OCR
          const ocrResult = await performOCR(page.imageUrl);

          // Apply cleanup if enabled for this project
          const extractedText = project.enableCleanup === 'yes' 
            ? cleanupOCRText(ocrResult.extractedText)
            : ocrResult.extractedText;

          // Update page with OCR results
          await updatePage(input.pageId, {
            extractedText,
            detectedPageNumber: ocrResult.detectedPageNumber,
            formattingData: ocrResult.formattingData as any,
            status: "completed",
            errorMessage: null,
          });

          // Update project processed pages count
          await updateProject(page.projectId, {
            processedPages: project.processedPages + 1,
          });

          return {
            success: true,
            pageNumber: ocrResult.detectedPageNumber,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "OCR processing failed";
          await updatePage(input.pageId, {
            status: "failed",
            errorMessage,
          });
          throw new Error(errorMessage);
        }
      }),

    // Update extracted text for a page
    updateText: protectedProcedure
      .input(
        z.object({
          pageId: z.number(),
          extractedText: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const page = await getPageById(input.pageId);
        if (!page) {
          throw new Error("Page not found");
        }

        const project = await getProjectById(page.projectId);
        if (!project || project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        await updatePage(input.pageId, {
          extractedText: input.extractedText,
        });

        return { success: true };
      }),

    // Add additional pages to existing project with intelligent placement
    addPages: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          pages: z.array(
            z.object({
              filename: z.string(),
              imageData: z.string(), // Base64 encoded image
              mimeType: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const { determinePlacement, reorderPages } = await import("./placementService");
        const existingPages = await getPagesByProjectId(input.projectId);
        const results = [];

        for (const pageData of input.pages) {
          try {
            // Convert base64 to buffer
            const base64Data = pageData.imageData.split(",")[1] || pageData.imageData;
            const buffer = Buffer.from(base64Data, "base64");

            // Upload to S3
            const fileKey = `projects/${input.projectId}/pages/${nanoid()}-${pageData.filename}`;
            const { url } = await storagePut(fileKey, buffer, pageData.mimeType);

            // Perform OCR first to detect page number
            const ocrResult = await performOCR(url);

            // Apply cleanup if enabled for this project
            const extractedText = project.enableCleanup === 'yes' 
              ? cleanupOCRText(ocrResult.extractedText)
              : ocrResult.extractedText;

            // Determine placement
            const placement = determinePlacement(
              ocrResult.detectedPageNumber,
              pageData.filename,
              existingPages.map(p => ({
                id: p.id,
                sortOrder: p.sortOrder,
                detectedPageNumber: p.detectedPageNumber,
                filename: p.filename,
              }))
            );

            // Create page record with placement info
            const page = await createPage({
              projectId: input.projectId,
              filename: pageData.filename,
              imageKey: fileKey,
              imageUrl: url,
              status: "completed",
              extractedText,
              detectedPageNumber: ocrResult.detectedPageNumber,
              formattingData: ocrResult.formattingData as any,
              confidenceScore: Math.round(ocrResult.confidence * 100),
              sortOrder: Math.floor(placement.sortOrder),
              placementConfidence: placement.confidence,
              needsValidation: placement.needsValidation,
            });

            // Reorder existing pages if needed
            const updates = reorderPages(
              existingPages.map(p => ({
                id: p.id,
                sortOrder: p.sortOrder,
                detectedPageNumber: p.detectedPageNumber,
                filename: p.filename,
              })),
              placement.sortOrder
            );

            for (const [pageId, newOrder] of Array.from(updates.entries())) {
              await updatePage(pageId, { sortOrder: newOrder });
            }

            results.push({
              filename: pageData.filename,
              success: true,
              pageId: page.id,
              sortOrder: placement.sortOrder,
              confidence: placement.confidence,
              needsValidation: placement.needsValidation,
              reason: placement.reason,
            });
          } catch (error) {
            results.push({
              filename: pageData.filename,
              success: false,
              error: error instanceof Error ? error.message : "Upload failed",
            });
          }
        }

        return {
          success: true,
          results,
        };
      }),

    // Manually reorder pages by dragging
    reorderManual: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          pageIds: z.array(z.number()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        // Update sort order for each page
        for (let i = 0; i < input.pageIds.length; i++) {
          await updatePage(input.pageIds[i]!, {
            sortOrder: i,
          });
        }

        return { success: true };
      }),
  }),

  export: router({
    // Preview first 3 pages in selected format
    preview: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          format: z.enum(["md", "txt"]),
        })
      )
      .query(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const pages = await getPagesByProjectId(input.projectId);
        
        // Filter only completed pages and take first 3
        const completedPages = pages
          .filter(p => p.status === "completed")
          .slice(0, 3);
        
        if (completedPages.length === 0) {
          throw new Error("No completed pages to preview");
        }

        const result = await exportDocument(completedPages, input.format as ExportFormat);
        
        // Return as string for preview
        const previewText = Buffer.isBuffer(result) 
          ? result.toString("utf-8")
          : result;
        
        return {
          preview: previewText,
          pageCount: completedPages.length,
          totalPages: pages.filter(p => p.status === "completed").length,
        };
      }),

    // Export project to specified format
    generate: protectedProcedure
      .input(
        z.object({
          projectId: z.number(),
          format: z.enum(["md", "txt", "pdf", "docx"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await getProjectById(input.projectId);
        if (!project) {
          throw new Error("Project not found");
        }
        if (project.userId !== ctx.user.id) {
          throw new Error("Unauthorized");
        }

        const pages = await getPagesByProjectId(input.projectId);
        
        // Filter only completed pages
        const completedPages = pages.filter(p => p.status === "completed");
        
        if (completedPages.length === 0) {
          throw new Error("No completed pages to export");
        }

        const result = await exportDocument(completedPages, input.format as ExportFormat);
        
        // Convert to base64 for transmission
        const base64 = Buffer.isBuffer(result) 
          ? result.toString("base64")
          : Buffer.from(result).toString("base64");
        
        return {
          data: base64,
          filename: `${project.title}.${input.format}`,
          mimeType: getMimeType(input.format),
        };
      }),
  }),
});

function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    md: "text/markdown",
    txt: "text/plain",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return mimeTypes[format] || "application/octet-stream";
}

export type AppRouter = typeof appRouter;
