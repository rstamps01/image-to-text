import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Search } from "lucide-react";

interface SortablePageCardProps {
  page: {
    id: number;
    imageUrl: string;
    filename: string;
    status: string;
    pageNumber: number | null;
    extractedText: string | null;
    errorMessage: string | null;
    confidenceScore: number | null;
    placementConfidence?: number | null;
    needsValidation?: string | null;
  };
  onPreview: () => void;
  onRetry: () => void;
  isRetrying: boolean;
}

export function SortablePageCard({ page, onPreview, onRetry, isRetrying }: SortablePageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getStatusBadge = () => {
    switch (page.status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-500/10 text-green-600 rounded">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-500/10 text-blue-600 rounded">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-500/10 text-red-600 rounded">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-500/10 text-gray-600 rounded">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group rounded-lg border border-border overflow-hidden bg-card hover:shadow-elegant transition-elegant cursor-grab active:cursor-grabbing"
    >
      <div 
        className="aspect-[3/4] relative"
        onClick={(e) => {
          // Only trigger preview if not dragging
          if (!isDragging) {
            onPreview();
          }
        }}
      >
        <img
          src={page.imageUrl}
          alt={page.filename}
          className="w-full h-full object-cover pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-elegant" />
        
        {/* Magnifying glass icon for completed pages */}
        {page.status === "completed" && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onPreview();
              }}
              className="opacity-0 group-hover:opacity-100 transition-elegant shadow-lg h-8 w-8 p-0 pointer-events-auto"
            >
              <Search className="w-4 h-4" />
            </Button>
          </div>
        )}
        
        {/* Retry button for failed pages */}
        {page.status === "failed" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              disabled={isRetrying}
              className="opacity-0 group-hover:opacity-100 transition-elegant shadow-lg"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </>
              )}
            </Button>
          </div>
        )}
      </div>
      
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">{page.filename}</p>
          {getStatusBadge()}
        </div>
        {page.pageNumber !== null && (
          <p className="text-xs text-muted-foreground">
            Page {page.pageNumber}
          </p>
        )}
        {page.status === "completed" && page.confidenceScore !== null && (
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  page.confidenceScore >= 90 ? "bg-green-500" :
                  page.confidenceScore >= 70 ? "bg-yellow-500" :
                  "bg-red-500"
                }`}
                style={{ width: `${page.confidenceScore}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {page.confidenceScore}%
            </span>
          </div>
        )}
        {page.errorMessage && (
          <p className="text-xs text-destructive mt-1">{page.errorMessage}</p>
        )}
        {page.needsValidation === "yes" && (
          <div className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 rounded border border-yellow-500/20">
            <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
            Verify placement
          </div>
        )}
      </div>
    </div>
  );
}
