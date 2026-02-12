import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortablePageCard } from "@/components/SortablePageCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const projectId = params?.id ? parseInt(params.id) : 0;

  const [exportFormat, setExportFormat] = useState<"md" | "txt" | "pdf" | "docx">("pdf");
  const [isExporting, setIsExporting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryingPageId, setRetryingPageId] = useState<number | null>(null);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [retryingProgress, setRetryingProgress] = useState({ current: 0, total: 0 });
  const [previewPage, setPreviewPage] = useState<{ id: number; url: string; filename: string; extractedText: string | null; status: string } | null>(null);
  const [editedText, setEditedText] = useState<string>("");
  const [isSavingText, setIsSavingText] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"md" | "txt">("md");
  const [localPages, setLocalPages] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [imageZoom, setImageZoom] = useState(100);
  const imageScrollRef = useRef<HTMLDivElement>(null);
  const textScrollRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data, isLoading, refetch } = trpc.projects.get.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const deleteProjectMutation = trpc.projects.delete.useMutation();
  const updateSettingsMutation = trpc.projects.updateSettings.useMutation({
    onSuccess: () => {
      // Refresh project data to show updated settings
      trpc.useUtils().projects.list.invalidate();
    },
  });
  const exportMutation = trpc.export.generate.useMutation();
  const retryFailedMutation = trpc.pages.retryFailed.useMutation();
  const retrySingleMutation = trpc.pages.retrySingle.useMutation();
  const updateTextMutation = trpc.pages.updateText.useMutation();
  const reorderMutation = trpc.pages.reorderManual.useMutation();
  const addPagesMutation = trpc.pages.addPages.useMutation();
  
  const { data: previewData, isLoading: isLoadingPreview, refetch: refetchPreview } = trpc.export.preview.useQuery(
    { projectId, format: previewFormat },
    { enabled: showPreview && projectId > 0 }
  );

  // Sync local pages with data
  useEffect(() => {
    if (data?.pages) {
      setLocalPages(data.pages);
    }
  }, [data?.pages]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setIsDragging(false);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localPages.findIndex((p) => p.id === active.id);
    const newIndex = localPages.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newPages = arrayMove(localPages, oldIndex, newIndex);
    setLocalPages(newPages);

    try {
      await reorderMutation.mutateAsync({
        projectId,
        pageIds: newPages.map((p) => p.id),
      });
      toast.success("Pages reordered successfully");
      await refetch();
    } catch (error) {
      toast.error("Failed to reorder pages");
      setLocalPages(data?.pages || []);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProjectMutation.mutateAsync({ projectId });
      toast.success("Project deleted successfully");
      setLocation("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  const handleAddPages = async (files: File[]) => {
    try {
      const pages = await Promise.all(
        files.map(async (file) => {
          const reader = new FileReader();
          const imageData = await new Promise<string>((resolve) => {
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });

          return {
            filename: file.name,
            imageData,
            mimeType: file.type,
          };
        })
      );

      const result = await addPagesMutation.mutateAsync({
        projectId,
        pages,
      });

      const successCount = result.results.filter((r: any) => r.success).length;
      const needsValidation = result.results.filter((r: any) => r.needsValidation === "yes");

      if (successCount > 0) {
        toast.success(`Added ${successCount} page(s) successfully`);
        if (needsValidation.length > 0) {
          toast.warning(`${needsValidation.length} page(s) need validation. Check placement carefully.`);
        }
        await refetch();
      }

      if (successCount < files.length) {
        toast.error(`Failed to add ${files.length - successCount} page(s)`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add pages");
    }
  };

  const handleExport = async () => {
    if (!data?.project) return;

    setIsExporting(true);
    try {
      const result = await exportMutation.mutateAsync({
        projectId,
        format: exportFormat,
      });

      // Convert base64 to blob and download
      const byteCharacters = atob(result.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Document exported successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export document");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!data?.project) return;

    const failedPages = data.pages.filter((p) => p.status === "failed");
    if (failedPages.length === 0) {
      toast.info("No failed pages to retry");
      return;
    }

    setIsRetrying(true);
    setRetryingProgress({ current: 0, total: failedPages.length });

    try {
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < failedPages.length; i++) {
        try {
          await retrySingleMutation.mutateAsync({ pageId: failedPages[i].id });
          successCount++;
        } catch (error) {
          failCount++;
        }
        setRetryingProgress({ current: i + 1, total: failedPages.length });
      }

      if (successCount > 0) {
        toast.success(
          `Retried ${failedPages.length} pages. ${successCount} succeeded.` +
            (failCount > 0 ? ` ${failCount} failed.` : "")
        );
      } else {
        toast.error("All pages failed to process");
      }

      // Refresh the project data to show updated statuses
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry pages");
    } finally {
      setIsRetrying(false);
      setRetryingProgress({ current: 0, total: 0 });
    }
  };

  const handleRetrySingle = async (pageId: number) => {
    setRetryingPageId(pageId);
    try {
      const result = await retrySingleMutation.mutateAsync({ pageId });
      toast.success(
        result.pageNumber
          ? `Page ${result.pageNumber} processed successfully`
          : "Page processed successfully"
      );
      // Refresh the project data to show updated status
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to retry page");
    } finally {
      setRetryingPageId(null);
    }
  };

  const handleProcessPending = async () => {
    if (!data?.project) return;

    setIsProcessing(true);
    setProcessingProgress({ current: 0, total: pendingPages.length });

    try {
      // Process each pending page
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < pendingPages.length; i++) {
        try {
          await retrySingleMutation.mutateAsync({ pageId: pendingPages[i].id });
          successCount++;
        } catch (error) {
          failCount++;
        }
        setProcessingProgress({ current: i + 1, total: pendingPages.length });
      }

      if (successCount > 0) {
        toast.success(
          `Processed ${successCount} pages successfully` +
            (failCount > 0 ? `. ${failCount} failed.` : "")
        );
      } else {
        toast.error("All pages failed to process");
      }

      // Refresh the project data
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process pages");
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Project Not Found</CardTitle>
            <CardDescription>The project you're looking for doesn't exist.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Back to Projects</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { project, pages } = data;
  const completedPages = pages.filter(p => p.status === "completed");
  const failedPages = pages.filter(p => p.status === "failed");
  const processingPages = pages.filter(p => p.status === "processing");
  const pendingPages = pages.filter(p => p.status === "pending");

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Projects
            </Link>
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
              {project.description && (
                <p className="text-muted-foreground">{project.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;
                input.onchange = async (e: any) => {
                  const files = Array.from(e.target.files || []) as File[];
                  if (files.length > 0) {
                    await handleAddPages(files);
                  }
                };
                input.click();
              }}>
                <FileText className="mr-2 w-4 h-4" />
                Add Pages
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-2 w-4 h-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this project? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pages.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{completedPages.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{processingPages.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{failedPages.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* OCR Cleanup Toggle */}
        <Card className="shadow-elegant mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Post-OCR Text Cleanup</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically remove common OCR artifacts (duplicate spaces, stray punctuation, formatting inconsistencies) from extracted text
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={project.enableCleanup === 'yes'}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    updateSettingsMutation.mutate({
                      projectId: project.id,
                      enableCleanup: enabled ? 'yes' : 'no',
                    });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Process Pending Pages Button */}
        {pendingPages.length > 0 && (
          <Card className="shadow-elegant mb-8 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-blue-600 mb-1">
                    {pendingPages.length} {pendingPages.length === 1 ? "page" : "pages"} pending
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Start OCR processing for all pending pages
                  </p>
                </div>
                <Button
                  onClick={handleProcessPending}
                  disabled={isProcessing}
                  variant="outline"
                  className="border-blue-500/30 hover:bg-blue-500/10"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 w-4 h-4" />
                      Process All Pending
                    </>
                  )}
                </Button>
              </div>
              {isProcessing && processingProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Processing page {processingProgress.current} of {processingProgress.total}
                    </span>
                    <span className="font-medium text-blue-600">
                      {Math.round((processingProgress.current / processingProgress.total) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={(processingProgress.current / processingProgress.total) * 100}
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Retry Failed Pages Button */}
        {failedPages.length > 0 && (
          <Card className="shadow-elegant mb-8 border-destructive/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-destructive mb-1">
                    {failedPages.length} {failedPages.length === 1 ? "page" : "pages"} failed
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Retry OCR processing for all failed pages at once
                  </p>
                </div>
                <Button
                  onClick={handleRetryFailed}
                  disabled={isRetrying}
                  variant="outline"
                  className="border-destructive/30 hover:bg-destructive/10"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 w-4 h-4" />
                      Retry All Failed
                    </>
                  )}
                </Button>
              </div>
              {isRetrying && retryingProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Retrying page {retryingProgress.current} of {retryingProgress.total}
                    </span>
                    <span className="font-medium text-destructive">
                      {Math.round((retryingProgress.current / retryingProgress.total) * 100)}%
                    </span>
                  </div>
                  <Progress
                    value={(retryingProgress.current / retryingProgress.total) * 100}
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Export Section */}
        {completedPages.length > 0 && (
          <Card className="shadow-elegant mb-8">
            <CardHeader>
              <CardTitle>Export Document</CardTitle>
              <CardDescription>
                Download your converted document in your preferred format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div className="flex-1 max-w-xs space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <Select value={exportFormat} onValueChange={(v: any) => setExportFormat(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                      <SelectItem value="docx">Word (.docx)</SelectItem>
                      <SelectItem value="md">Markdown (.md)</SelectItem>
                      <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (exportFormat === "pdf" || exportFormat === "docx") {
                      setPreviewFormat("md");
                    } else {
                      setPreviewFormat(exportFormat);
                    }
                    setShowPreview(true);
                  }}
                  disabled={isExporting}
                  size="lg"
                  className="shadow-elegant"
                >
                  <FileText className="mr-2 w-5 h-5" />
                  Preview
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={isExporting}
                  size="lg"
                  className="shadow-elegant"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 w-5 h-5" />
                      Export
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pages Grid */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Pages ({localPages.length})</CardTitle>
            <CardDescription>
              Drag and drop to reorder pages manually
            </CardDescription>
          </CardHeader>
          <CardContent>
            {localPages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pages uploaded yet</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                onDragStart={() => setIsDragging(true)}
              >
                <SortableContext
                  items={localPages.map(p => p.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {localPages.map(page => (
                      <SortablePageCard
                        key={page.id}
                        page={page}
                        onPreview={() => {
                          setPreviewPage({ 
                            id: page.id, 
                            url: page.imageUrl, 
                            filename: page.filename,
                            extractedText: page.extractedText,
                            status: page.status
                          });
                          setEditedText(page.extractedText || "");
                        }}
                        onRetry={() => handleRetrySingle(page.id)}
                        isRetrying={retryingPageId === page.id}
                      />
                ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Image Preview Modal with Text Editor */}
      <Dialog open={previewPage !== null} onOpenChange={(open) => !open && setPreviewPage(null)}>
        <DialogContent className="!w-screen !max-w-none h-[95vh] !m-0 !left-0 !translate-x-0 !top-1/2 !-translate-y-1/2">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{previewPage?.filename}</span>
              {previewPage?.status === "completed" && (
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!previewPage) return;
                    setIsSavingText(true);
                    try {
                      await updateTextMutation.mutateAsync({
                        pageId: previewPage.id,
                        extractedText: editedText,
                      });
                      toast.success("Text saved successfully");
                      await refetch();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Failed to save text");
                    } finally {
                      setIsSavingText(false);
                    }
                  }}
                  disabled={isSavingText || editedText === previewPage?.extractedText}
                >
                  {isSavingText ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Zoom Controls */}
            <div className="flex items-center gap-4 justify-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageZoom(Math.max(50, imageZoom - 10))}
              >
                <span className="text-lg">-</span>
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">{imageZoom}%</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageZoom(Math.min(200, imageZoom + 10))}
              >
                <span className="text-lg">+</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImageZoom(100)}
              >
                Reset
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6 h-[calc(95vh-180px)] w-full">
              {/* Image Preview with Synchronized Scroll */}
              <div 
                ref={imageScrollRef}
                className="relative overflow-auto border rounded-lg"
                onScroll={(e) => {
                  if (textScrollRef.current) {
                    const scrollPercentage = e.currentTarget.scrollTop / (e.currentTarget.scrollHeight - e.currentTarget.clientHeight);
                    textScrollRef.current.scrollTop = scrollPercentage * (textScrollRef.current.scrollHeight - textScrollRef.current.clientHeight);
                  }
                }}
              >
                <img
                  src={previewPage?.url}
                  alt={previewPage?.filename}
                  style={{ width: `${imageZoom}%`, height: 'auto' }}
                  className="block"
                />
              </div>
              {/* Text Editor with Matched Formatting */}
              <div className="flex flex-col">
                <h3 className="text-sm font-medium mb-2">Extracted Text</h3>
                {previewPage?.status === "completed" ? (
                  <div
                    ref={textScrollRef}
                    className="flex-1 overflow-auto border rounded-lg"
                    onScroll={(e) => {
                      if (imageScrollRef.current) {
                        const scrollPercentage = e.currentTarget.scrollTop / (e.currentTarget.scrollHeight - e.currentTarget.clientHeight);
                        imageScrollRef.current.scrollTop = scrollPercentage * (imageScrollRef.current.scrollHeight - imageScrollRef.current.clientHeight);
                      }
                    }}
                  >
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="w-full h-full p-3 resize-none font-mono text-sm leading-normal focus:outline-none focus:ring-2 focus:ring-primary"
                      style={{ minHeight: '100%', whiteSpace: 'pre-wrap', textAlign: 'justify', textJustify: 'inter-word' }}
                      placeholder="No text extracted"
                    />
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center border rounded-lg bg-muted/50">
                    <p className="text-muted-foreground text-sm">
                      {previewPage?.status === "processing" ? "OCR processing in progress..." :
                       previewPage?.status === "failed" ? "OCR failed for this page" :
                       "No text available yet"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Export Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Export Preview - First {previewData?.pageCount || 0} Pages</span>
              <div className="flex gap-2">
                <Select value={previewFormat} onValueChange={(v: "md" | "txt") => setPreviewFormat(v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="md">Markdown</SelectItem>
                    <SelectItem value="txt">Plain Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="relative max-h-[70vh] overflow-auto">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : previewData ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  Showing first {previewData.pageCount} of {previewData.totalPages} completed pages
                </div>
                <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-muted/30 rounded-lg border">
                  {previewData.preview}
                </pre>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No preview available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
