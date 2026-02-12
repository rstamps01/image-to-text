import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects table - represents a document conversion project
 * Each project contains multiple book page images to be converted
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["uploading", "processing", "completed", "failed"]).default("uploading").notNull(),
  totalPages: int("totalPages").default(0).notNull(),
  processedPages: int("processedPages").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Pages table - represents individual book page images and their OCR results
 * Each page belongs to a project and contains the extracted text and metadata
 */
export const pages = mysqlTable("pages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  /** Original filename of the uploaded image */
  filename: varchar("filename", { length: 255 }).notNull(),
  /** S3 storage key for the uploaded image */
  imageKey: varchar("imageKey", { length: 512 }).notNull(),
  /** Public URL to access the image */
  imageUrl: text("imageUrl").notNull(),
  /** Detected page number (can be Arabic numeral, Roman numeral, or null if not detected) */
  detectedPageNumber: varchar("detectedPageNumber", { length: 50 }),
  /** Numeric sort order based on detected page number */
  sortOrder: int("sortOrder"),
  /** OCR processing status */
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  /** Extracted text content from OCR */
  extractedText: text("extractedText"),
  /** OCR confidence score (0-100) indicating the reliability of the extracted text */
  confidenceScore: int("confidenceScore"),
  /** Structured formatting information (paragraphs, headings, lists, etc.) */
  formattingData: json("formattingData"),
  /** Error message if OCR failed */
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Page = typeof pages.$inferSelect;
export type InsertPage = typeof pages.$inferInsert;
