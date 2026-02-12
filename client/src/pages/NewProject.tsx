import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Upload, X, FileImage, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface UploadedFile {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "processing" | "completed" | "failed";
  progress: number; // 0-100 percentage
  pageNumber?: string;
  error?: string;
}

export default function NewProject() {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [enableCleanup, setEnableCleanup] = useState(false);

  const createProjectMutation = trpc.projects.create.useMutation();
  const uploadPageMutation = trpc.pages.upload.useMutation();
  const processOCRMutation = trpc.pages.processOCR.useMutation();
  const reorderPagesMutation = trpc.pages.reorder.useMutation();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith("image/")
    );

    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  }, []);

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending" as const,
      progress: 0,
    }));

    setFiles(prev => [...prev, ...uploadedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    if (files.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    setIsCreating(true);

    try {
      // Create project
      const project = await createProjectMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        enableCleanup,
      });

      toast.success("Project created successfully");

      // Upload and process each file
      const pageIds: number[] = [];

      for (let i = 0; i < files.length; i++) {
        const uploadedFile = files[i];

        try {
          // Update status to uploading
          setFiles(prev => {
            const updated = [...prev];
            updated[i].status = "uploading";
            updated[i].progress = 10;
            return updated;
          });

          // Convert file to base64
          const base64 = await fileToBase64(uploadedFile.file);

          // Upload page
          const page = await uploadPageMutation.mutateAsync({
            projectId: project.id,
            filename: uploadedFile.file.name,
            imageData: base64,
            mimeType: uploadedFile.file.type,
          });

          pageIds.push(page.id);

          // Update status to processing
          setFiles(prev => {
            const updated = [...prev];
            updated[i].status = "processing";
            updated[i].progress = 50;
            return updated;
          });

          // Process OCR
          const ocrResult = await processOCRMutation.mutateAsync({
            pageId: page.id,
          });

          // Update status to completed
          setFiles(prev => {
            const updated = [...prev];
            updated[i].status = "completed";
            updated[i].progress = 100;
            updated[i].pageNumber = ocrResult.pageNumber || undefined;
            return updated;
          });
        } catch (error) {
          console.error("Error processing file:", error);
          setFiles(prev => {
            const updated = [...prev];
            updated[i].status = "failed";
            updated[i].progress = 0;
            updated[i].error = error instanceof Error ? error.message : "Processing failed";
            return updated;
          });
        }
      }

      // Reorder pages based on detected page numbers
      if (pageIds.length > 0) {
        await reorderPagesMutation.mutateAsync({
          projectId: project.id,
        });
      }

      toast.success("All pages processed successfully");
      setLocation(`/projects/${project.id}`);
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create project");
      setIsCreating(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const allCompleted = files.length > 0 && files.every(f => f.status === "completed");
  const hasErrors = files.some(f => f.status === "failed");

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link href="/">
              <ArrowLeft className="mr-2 w-4 h-4" />
              Back to Projects
            </Link>
          </Button>
          <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
          <p className="text-muted-foreground">
            Upload book page images to convert them into searchable documents
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Details */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>Give your project a name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="e.g., Chapter 5: Machine Learning"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={isCreating}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description of the content"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={isCreating}
                  rows={3}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                <div className="space-y-0.5">
                  <Label htmlFor="cleanup-toggle" className="text-base cursor-pointer">
                    Enable Text Cleanup
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically remove duplicate spaces, stray punctuation, and formatting artifacts during OCR processing
                  </p>
                </div>
                <Switch
                  id="cleanup-toggle"
                  checked={enableCleanup}
                  onCheckedChange={setEnableCleanup}
                  disabled={isCreating}
                />
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="shadow-elegant">
            <CardHeader>
              <CardTitle>Upload Images</CardTitle>
              <CardDescription>
                Drag and drop images or click to select. Supports PNG, JPG, and WEBM formats.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-elegant ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">Drop images here</p>
                <p className="text-sm text-muted-foreground mb-4">or</p>
                <Button type="button" variant="outline" disabled={isCreating} asChild>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isCreating}
                    />
                    Select Files
                  </label>
                </Button>
              </div>

              {/* Uploaded Files List */}
              {files.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-medium">Uploaded Files ({files.length})</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {files.map((uploadedFile, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                      >
                        <img
                          src={uploadedFile.preview}
                          alt={uploadedFile.file.name}
                          className="w-12 h-12 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate">
                              {uploadedFile.file.name}
                            </p>
                            {(uploadedFile.status === "uploading" ||
                              uploadedFile.status === "processing") && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {uploadedFile.progress}%
                              </span>
                            )}
                          </div>
                          
                          {/* Progress Bar */}
                          {(uploadedFile.status === "uploading" ||
                            uploadedFile.status === "processing" ||
                            uploadedFile.status === "completed") && (
                            <Progress 
                              value={uploadedFile.progress} 
                              className="h-1.5 mb-2"
                            />
                          )}
                          
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                uploadedFile.status === "completed"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : uploadedFile.status === "failed"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : uploadedFile.status === "processing" ||
                                    uploadedFile.status === "uploading"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                              }`}
                            >
                              {uploadedFile.status}
                            </span>
                            {uploadedFile.pageNumber && (
                              <span className="text-xs text-muted-foreground">
                                Page {uploadedFile.pageNumber}
                              </span>
                            )}
                            {uploadedFile.error && (
                              <span className="text-xs text-destructive truncate">
                                {uploadedFile.error}
                              </span>
                            )}
                          </div>
                        </div>
                        {uploadedFile.status === "pending" && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            disabled={isCreating}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                        {(uploadedFile.status === "uploading" ||
                          uploadedFile.status === "processing") && (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              type="submit"
              size="lg"
              disabled={isCreating || files.length === 0}
              className="shadow-elegant"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Create Project & Process"
              )}
            </Button>
            {!isCreating && (
              <Button type="button" variant="outline" size="lg" asChild>
                <Link href="/">Cancel</Link>
              </Button>
            )}
          </div>

          {hasErrors && (
            <p className="text-sm text-destructive">
              Some files failed to process. You can still create the project with the successful
              files.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
