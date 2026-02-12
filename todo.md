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
- [x] Add bulk deletion feature for projects with checkboxes
- [x] Fix individual project checkboxes not responding to clicks
- [x] Add real-time progress indicators to Project Detail page for OCR operations
- [x] Add image preview modal for viewing full-size page images
- [x] Add text preview and editing to modal with side-by-side image and text view
- [x] Add export preview showing first 3 pages before full document generation
- [x] Add drag-and-drop page reordering with visual feedback and sort order updates
- [x] Add OCR confidence scores to completed pages with percentage display

## New Feature: Add Pages to Existing Projects
- [x] Add placementConfidence field to pages table schema
- [x] Implement intelligent placement algorithm based on page numbers
- [x] Add fallback placement logic using filename and metadata analysis
- [x] Create UI for uploading additional pages to existing projects
- [x] Display validation warnings for uncertain placements
- [x] Add visual indicators on pages requiring user validation

## New Feature: Enhanced Side-by-Side Comparison View
- [x] Add magnified readable image view with zoom controls
- [x] Implement synchronized scrolling between image and text
- [x] Match text formatting to original layout (font size, line spacing, paragraph breaks)
- [x] Add visual alignment guides for easier comparison

## Current Issues
- [x] Debug and fix OCR processing error: "500 Internal Server Error - received bad response from upstream"

## UI Improvements
- [x] Expand side-by-side comparison modal to use full browser window
- [x] Expand modal to full viewport width for wide side-by-side viewing
- [x] Add magnifying glass icon button for single-click modal access

## Bug Fixes (Current)
- [x] Fix magnifying glass icon click event not opening modal
- [x] Fix modal to dynamically expand to full browser width
- [x] Enable single-click on thumbnail to open modal (already working)
- [x] Fix modal positioning to be centered vertically
- [x] Fix click detection interference with drag-and-drop (requires multiple fast clicks)

## OCR Enhancements
- [x] Add table of contents structure recognition with dotted leaders and page numbers
- [x] Improve text formatting to match original layout with proper line breaks
- [x] Ensure each line starts and ends with the same words as the original image
- [x] Preserve indentation, line spacing, and paragraph spacing
- [x] Format extracted text with proper indentation and justification to match original image
- [x] Fix PDF export error: WinAnsi encoding cannot handle newline characters
- [x] Fix excessive dots in table of contents formatting (should use proper leader dots, not extract all dots)

## Post-OCR Cleanup Feature
- [x] Add enableCleanup boolean field to projects table schema
- [x] Implement text cleanup function to remove OCR artifacts
- [x] Add cleanup toggle UI in project detail page
- [x] Apply cleanup conditionally based on project setting
- [x] Write tests for cleanup functionality

## Bug Fixes (Urgent)
- [x] Fix invalid hook call error in updateSettings mutation (trpc.useUtils() called in callback)

## Bug Fixes (Current)
- [x] Fix cleanup toggle switch requiring browser refresh to update position

## Cleanup Preview Feature
- [x] Add backend endpoint to generate cleanup preview for a sample page
- [x] Create preview modal UI with side-by-side original vs cleaned text comparison
- [x] Add "Preview Cleanup" button next to the cleanup toggle
- [x] Test the preview feature with various text samples

## Modal Expansion
- [x] Expand cleanup preview modal to use full browser window dimensions
- [x] Fix cleanup preview modal to fill entire browser width (currently showing background page)

## Add Cleanup Toggle to Project Creation
- [x] Add cleanup toggle to project creation form UI
- [x] Update backend createProject to accept enableCleanup parameter
- [x] Test cleanup applies during initial page upload when enabled at creation
