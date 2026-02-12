# Book Page Converter - Project TODO

## Phase 1: Foundation & Design System
- [x] Set up elegant design system with color palette and typography
- [x] Configure theme and global styles in index.css
- [x] Add custom fonts via Google Fonts CDN

## Phase 2: Database Schema
- [x] Create projects table for document conversion projects
- [x] Create pages table for individual page images and OCR results
- [x] Add database helper functions for CRUD operations
- [x] Generate and apply database migrations

## Phase 3: Backend OCR & Page Detection
- [x] Implement vision LLM integration for OCR processing
- [x] Build intelligent page number detection (Arabic, Roman numerals)
- [x] Create page ordering algorithm based on detected numbers
- [x] Add tRPC procedures for upload and OCR processing
- [x] Implement S3 storage integration for uploaded images

## Phase 4: Document Export
- [x] Implement Markdown (.md) export with formatting
- [x] Implement plain text (.txt) export
- [x] Implement PDF (.pdf) export with formatting
- [x] Implement Word (.docx) export with formatting
- [x] Add tRPC procedures for document generation

## Phase 5: Frontend Upload Interface
- [x] Create project creation page with elegant design
- [x] Build drag-and-drop file upload component
- [x] Implement multi-file selection and preview
- [x] Add upload progress tracking UI
- [x] Show OCR processing status for each page
- [x] Display error handling for failed uploads

## Phase 6: Preview & Export Interface
- [x] Build page preview grid with thumbnails
- [x] Show detected page numbers and ordering
- [x] Allow manual page reordering if needed
- [x] Create export format selection interface
- [x] Add download functionality for all formats
- [x] Show document preview before export

## Phase 7: Testing & Deployment
- [x] Test complete upload-to-export workflow
- [x] Test with various image formats and qualities
- [x] Test page number detection edge cases
- [x] Verify all export formats work correctly
- [x] Create deployment checkpoint
- [x] Document usage instructions

## Bug Fixes
- [x] Fix "Page not found" error in processOCR procedure

## New Features
- [x] Add real-time progress bars for OCR processing
- [x] Add 'Retry All Failed' button to reprocess failed pages
- [x] Add individual 'Retry' icon button on each failed page thumbnail

## Bugs
- [x] Fix pages stuck in pending state - OCR not triggering automatically
- [x] Fix project cards showing 0 / 0 pages on home page
