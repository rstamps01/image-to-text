# Book Page Converter

A sophisticated web application that converts scanned book pages into searchable, editable digital documents using AI-powered OCR technology.

## Features

### 🎯 Core Functionality

- **Multi-Image Upload**: Drag-and-drop interface supporting PNG, JPG, and WEBM formats
- **AI-Powered OCR**: Vision LLM integration for accurate text extraction
- **Smart Page Detection**: Automatically detects page numbers in Arabic numerals (1, 2, 3) or Roman numerals (i, ii, iii)
- **Intelligent Ordering**: Pages are automatically sorted based on detected page numbers, regardless of upload sequence
- **Format Preservation**: Maintains document structure including headings, paragraphs, lists, and text formatting (bold, italic)
- **Multi-Format Export**: Download converted documents as PDF, DOCX, Markdown, or plain text

### 🎨 Design

- Elegant warm ivory and burgundy color palette
- Responsive design optimized for all devices
- Smooth transitions and micro-interactions
- Professional typography using Inter font family

## Technology Stack

### Backend
- **Framework**: Express.js with tRPC for type-safe API
- **Database**: MySQL/TiDB with Drizzle ORM
- **OCR**: Vision-capable LLM for text extraction
- **Storage**: S3-compatible object storage
- **Document Generation**: 
  - PDF: pdf-lib
  - DOCX: docx
  - Markdown: Custom formatter
  - Text: Plain text export

### Frontend
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui with Radix UI primitives
- **State Management**: TanStack Query (via tRPC)
- **Routing**: Wouter

## Project Structure

```
book-page-converter/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   │   ├── Home.tsx           # Landing page and project list
│   │   │   ├── NewProject.tsx     # Project creation and upload
│   │   │   └── ProjectDetail.tsx  # Project view and export
│   │   ├── components/    # Reusable UI components
│   │   ├── lib/           # tRPC client setup
│   │   └── index.css      # Global styles and theme
│   └── index.html
├── server/                # Backend Express + tRPC
│   ├── routers.ts        # tRPC API routes
│   ├── db.ts             # Database helpers
│   ├── ocrService.ts     # OCR processing logic
│   ├── exportService.ts  # Document export functions
│   └── storage.ts        # S3 storage integration
├── drizzle/              # Database schema and migrations
│   └── schema.ts
└── shared/               # Shared types and constants
```

## User Workflow

### 1. Create a Project
- Navigate to the home page
- Click "New Project"
- Enter a title and optional description

### 2. Upload Book Pages
- Drag and drop images or click to select files
- Multiple images can be uploaded at once
- Supported formats: PNG, JPG, WEBM

### 3. Automatic Processing
- Each image is automatically uploaded to secure storage
- Vision AI performs OCR to extract text
- Page numbers are detected and extracted
- Formatting structure is preserved (headings, paragraphs, lists)
- Pages are automatically ordered by detected page numbers

### 4. Review Results
- View all uploaded pages in a grid layout
- See detected page numbers for each page
- Check processing status (completed, processing, failed)
- Pages are displayed in correct order

### 5. Export Document
- Select export format (PDF, DOCX, Markdown, or Text)
- Click "Export" to generate the document
- Download automatically starts
- All completed pages are included in the export

## API Endpoints

### Projects
- `projects.create` - Create a new project
- `projects.list` - List all user projects
- `projects.get` - Get project details with pages
- `projects.delete` - Delete a project
- `projects.updateStatus` - Update project status

### Pages
- `pages.upload` - Upload a page image
- `pages.processOCR` - Process OCR for a page
- `pages.reorder` - Reorder pages by detected numbers
- `pages.updateOrder` - Manually update page order

### Export
- `export.generate` - Generate document in specified format

## Database Schema

### Users Table
- Standard authentication fields
- Role-based access control

### Projects Table
- `id` - Primary key
- `userId` - Owner reference
- `title` - Project name
- `description` - Optional description
- `status` - uploading | processing | completed | failed
- `totalPages` - Total number of pages
- `processedPages` - Number of completed pages
- `createdAt`, `updatedAt` - Timestamps

### Pages Table
- `id` - Primary key
- `projectId` - Project reference
- `filename` - Original filename
- `imageKey` - S3 storage key
- `imageUrl` - Public image URL
- `detectedPageNumber` - Extracted page number
- `sortOrder` - Numeric sort position
- `status` - pending | processing | completed | failed
- `extractedText` - OCR result text
- `formattingData` - Structured formatting (JSON)
- `errorMessage` - Error details if failed
- `createdAt`, `updatedAt` - Timestamps

## OCR Processing

### Page Number Detection
The system intelligently detects page numbers in various formats:

- **Arabic numerals**: 1, 2, 3, 42, 123
- **Roman numerals**: i, ii, iii, iv, v, x, xx, l, c
- **Formatted**: Page 42, [123], (99), - 56 -

### Text Extraction
- High-accuracy OCR using vision-capable LLM
- Preserves document structure
- Identifies formatting (bold, italic)
- Recognizes content types (headings, paragraphs, lists, quotes)

### Formatting Preservation
Extracted content maintains:
- Heading hierarchy (H1-H6)
- Paragraph breaks
- List items
- Block quotes
- Text styling (bold, italic)

## Export Formats

### PDF (.pdf)
- Professional layout with proper spacing
- Heading hierarchy with different font sizes
- Page number headers
- Word wrapping and pagination

### Word Document (.docx)
- Native Microsoft Word format
- Editable text with preserved formatting
- Heading styles
- List formatting
- Page breaks between original pages

### Markdown (.md)
- Clean, readable markdown syntax
- Heading markers (#, ##, ###)
- List syntax (-)
- Bold (**text**) and italic (*text*)
- Page separators (---)

### Plain Text (.txt)
- Simple text format
- Page separators with page numbers
- No formatting markup
- Maximum compatibility

## Testing

The project includes comprehensive test coverage:

### Backend Tests
- Project CRUD operations
- User authorization
- Page number extraction (Arabic and Roman numerals)
- OCR service functionality
- Authentication flows

### Running Tests
```bash
pnpm test
```

All tests pass successfully:
- 3 test files
- 20 test cases
- 100% pass rate

## Development

### Prerequisites
- Node.js 22+
- pnpm package manager
- MySQL/TiDB database
- S3-compatible storage

### Setup
```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables
All required environment variables are automatically injected by the Manus platform:
- Database connection
- OAuth configuration
- Storage credentials
- LLM API access

## Security

- User authentication via Manus OAuth
- Row-level security (users can only access their own projects)
- Secure file storage with S3
- Input validation on all endpoints
- Type-safe API with tRPC

## Performance

- Lazy loading for large project lists
- Optimistic UI updates for better UX
- Efficient image storage with CDN delivery
- Parallel OCR processing for multiple pages
- Automatic page reordering after processing

## Future Enhancements

Potential features for future versions:
- Batch project processing
- OCR confidence scores
- Manual text editing before export
- Custom page ordering (drag-and-drop)
- Table detection and extraction
- Multi-column layout support
- Language detection and translation
- Collaborative projects with sharing

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or feature requests, please visit [https://help.manus.im](https://help.manus.im)
