import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { BookOpen, FileText, Upload, Sparkles, ArrowRight, Plus } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const { data: projects, isLoading: projectsLoading } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="container py-20">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent-foreground text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              Powered by Vision AI
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Transform Book Pages into
              <span className="block text-primary mt-2">Searchable Documents</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Upload screenshots of book pages and convert them into perfectly formatted, searchable documents. 
              Our AI intelligently detects page numbers and preserves original formatting.
            </p>

            <div className="flex gap-4 justify-center pt-4">
              <Button size="lg" asChild className="shadow-elegant">
                <a href={getLoginUrl()}>
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
            <Card className="border-border/50 shadow-elegant hover:shadow-elegant-lg transition-elegant">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Easy Upload</CardTitle>
                <CardDescription className="text-base">
                  Drag and drop multiple images at once. Supports PNG, JPG, and WEBM formats.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50 shadow-elegant hover:shadow-elegant-lg transition-elegant">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Smart Detection</CardTitle>
                <CardDescription className="text-base">
                  Automatically detects page numbers in Arabic or Roman numerals and orders pages correctly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border/50 shadow-elegant hover:shadow-elegant-lg transition-elegant">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Multiple Formats</CardTitle>
                <CardDescription className="text-base">
                  Export to PDF, DOCX, Markdown, or plain text with preserved formatting.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated user view
  return (
    <div className="min-h-screen bg-background">
      <div className="container py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Projects</h1>
            <p className="text-muted-foreground">
              Convert book page screenshots into searchable documents
            </p>
          </div>
          <Button size="lg" asChild className="shadow-elegant">
            <Link href="/projects/new">
              <Plus className="mr-2 w-5 h-5" />
              New Project
            </Link>
          </Button>
        </div>

        {/* Projects Grid */}
        {projectsLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full mb-2" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map(project => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="border-border/50 shadow-elegant hover:shadow-elegant-lg transition-elegant cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-xl truncate">{project.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {project.description || "No description"}
                        </CardDescription>
                      </div>
                      <div className="flex-shrink-0">
                        <BookOpen className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {project.processedPages} / {project.totalPages} pages
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          project.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : project.status === "processing"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : project.status === "failed"
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {project.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-border/50 shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="w-16 h-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Create your first project to start converting book pages into searchable documents
              </p>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="mr-2 w-4 h-4" />
                  Create Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
