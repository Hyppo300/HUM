import { useQuery } from "@tanstack/react-query";
import { Article } from "@shared/schema";
import { useParams, useLocation } from "wouter";
import { ArticleViewer } from "@/components/ArticleViewer";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
export default function ArticlePage() {
  // Always declare hooks at the top level of your component
  const { id } = useParams<{ id: string }>();
  const [sessionArticle, setSessionArticle] = useState<Article | null>(null);
  const [, setLocation] = useLocation();

  // Try to get article from sessionStorage if ID is >= 1000 (News API articles)
  useEffect(() => {
    if (id && parseInt(id) >= 1000) {
      try {
        const storedArticle = sessionStorage.getItem(`article-${id}`);
        if (storedArticle) {
          const parsedArticle = JSON.parse(storedArticle) as Article;
          setSessionArticle(parsedArticle);
          console.log(
            "Retrieved article from sessionStorage:",
            parsedArticle.title,
          );
        }
      } catch (e) {
        console.error("Failed to retrieve article from sessionStorage:", e);
      }
    }
  }, [id]);

  // Only fetch from API if it's not a News API article (ID < 1000)
  const { data: article, isLoading } = useQuery<Article>({
    queryKey: [`/api/articles/${id}`],
    enabled: !sessionArticle && parseInt(id) < 1000, // Only run the query if we don't have a session article
  });

  // Use the session article first, then the API article if available
  const displayArticle = sessionArticle || article;

  // Render function that handles different states
  const renderContent = () => {
    // Show loading state if we're loading from API and don't have a session article
    if (isLoading && !sessionArticle) {
      return (
        <div className="p-6">
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      );
    }

    // Handle article not found scenario
    if (!displayArticle && !isLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
          <div className="max-w-md text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />

            <h1 className="text-2xl font-bold mb-2">Article Not Found</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              The article you're looking for doesn't exist or has been removed.
            </p>
            <Button
              onClick={() => setLocation("/")}
              variant="default"
              className="mx-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Homepage
            </Button>
          </div>
        </div>
      );
    }

    // Display the article if available
    return (
      <div>
        <div className=" bg-[url(https://static.vecteezy.com/system/resources/thumbnails/035/328/612/small/red-silk-fabric-texture-used-as-background-red-panne-fabric-background-of-soft-and-smooth-textile-material-crushed-velvet-luxury-scarlet-for-velvet-photo.jpg)] w-full  bg-cover bg-center bg-no-repeat min-h-screen bg-background">
          {displayArticle && (
            <div>
              <div
                className=" bg-[url(https://i.pinimg.com/736x/60/28/bb/6028bbed600e4948ad054c391eac6cf6.jpg)] bg-opacity-25 w-full  bg-cover bg-center bg-no-repeat  border-b bg-black sticky top-0 z-10 border-b bg-[#B3B3B4] sticky "
                style={{
                  paddingBottom: "10px",
                  fontSize: "20px",
                  height: "70px",
                }}
              >
                <div className="mx-auto px-4 py-4 container">
                  <div className="flex justify-between items-center mb-4">
                    {/* <h1
                      className="text-2xl font-bold text-white"
                      style={{ marginTop: "5px" }}
                    >
                      Global News Hub
                    </h1> */}
                    <Link
                      href={`/`}
                      className="inline-flex items-center font-bold text-white text-xl hover:text-red-700 transition-colors"
                    >
                      Global News Hub
                    </Link>
                  </div>
                </div>
              </div>
              <ArticleViewer
                article={displayArticle}
                onClose={() => window.history.back()}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Always return the result of renderContent
  return renderContent();
}
