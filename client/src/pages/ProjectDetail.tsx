import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
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

  const { data, isLoading, refetch } = trpc.projects.get.useQuery(
    { projectId },
    { enabled: projectId > 0 }
  );

  const deleteProjectMutation = trpc.projects.delete.useMutation();
  const exportMutation = trpc.export.generate.useMutation();
  const retryFailedMutation = trpc.pages.retryFailed.useMutation();
  const retrySingleMutation = trpc.pages.retrySingle.useMutation();

  const handleDelete = async () => {
    try {
      await deleteProjectMutation.mutateAsync({ projectId });
      toast.success("Project deleted successfully");
      setLocation("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete project");
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
            <CardTitle>Pages ({pages.length})</CardTitle>
            <CardDescription>
              Pages are automatically ordered by detected page numbers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No pages uploaded yet</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pages.map(page => (
                  <div
                    key={page.id}
                    className="relative group rounded-lg border border-border overflow-hidden bg-card hover:shadow-elegant transition-elegant"
                  >
                    <div className="aspect-[3/4] relative">
                      <img
                        src={page.imageUrl}
                        alt={page.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-elegant" />
                      
                      {/* Retry button for failed pages */}
                      {page.status === "failed" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRetrySingle(page.id)}
                            disabled={retryingPageId === page.id}
                            className="opacity-0 group-hover:opacity-100 transition-elegant shadow-lg"
                          >
                            {retryingPageId === page.id ? (
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
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-medium truncate">{page.filename}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            page.status === "completed"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : page.status === "failed"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : page.status === "processing"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                          }`}
                        >
                          {page.status}
                        </span>
                      </div>
                      {page.detectedPageNumber && (
                        <p className="text-xs text-muted-foreground">
                          Page {page.detectedPageNumber}
                        </p>
                      )}
                      {page.errorMessage && (
                        <p className="text-xs text-destructive mt-1">{page.errorMessage}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
