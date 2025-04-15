import { Article } from "@shared/schema";
import { NewsCard } from "@/components/news-card";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationInfo {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface NewsFeedProps {
  articles?: Article[];
  isLoading?: boolean;
  className?: string;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
}

// Custom hook for ensuring seamless article transitions
function useSmoothArticles(incomingArticles?: Article[], loading?: boolean) {
  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);
  const [hasShownArticles, setHasShownArticles] = useState(false);

  useEffect(() => {
    // Only update displayed articles if we have new ones and they're different from current
    if (incomingArticles?.length && 
        JSON.stringify(incomingArticles) !== JSON.stringify(displayedArticles)) {
      setDisplayedArticles(incomingArticles);
      setHasShownArticles(true);
    }
  }, [incomingArticles, displayedArticles]);

  // Always return something to display - either current articles or previous ones
  return hasShownArticles ? displayedArticles : [];
}

export function NewsFeed({ articles, isLoading, className, pagination, onPageChange }: NewsFeedProps) {
  // Use smooth articles to prevent content flashing during reloads
  const displayArticles = useSmoothArticles(articles, isLoading);

  // Only show the "no articles" message if:
  // 1. We're not loading anything
  // 2. We haven't received articles yet 
  // 3. We explicitly have an empty array (not undefined)
  const showEmptyState = !isLoading && articles !== undefined && articles.length === 0;

  // Handle pagination controls
  const handlePageChange = (newPage: number) => {
    if (onPageChange && pagination && newPage >= 1 && newPage <= pagination.totalPages) {
      onPageChange(newPage);
    }
  };

  if (showEmptyState) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Content will appear here as it becomes available.</p>
        <p className="mt-2 text-sm">Try selecting a different country or category.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className={cn("flex-grow pr-4", className)}>
        <div className="news-grid">
          {displayArticles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      </ScrollArea>

      {/* Pagination controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col md:flex-row justify-between items-center mt-6 py-4 border-t gap-4">
          <div className="text-sm text-muted-foreground">
            Showing page {pagination.page} of {pagination.totalPages}
            <span className="ml-2">({pagination.totalCount} articles total)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Page navigation */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              First
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page number buttons */}
            <div className="flex gap-1">
              {/* Calculate range of page numbers to show */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  // If we have 5 or fewer pages, show all
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  // If we're near the start, show pages 1-5
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  // If we're near the end, show the last 5 pages
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  // Otherwise show current page and 2 on either side
                  pageNum = pagination.page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pagination.page === pageNum ? "default" : "outline"}
                    size="sm"
                    className="w-8 px-0"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isLoading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handlePageChange(pagination.totalPages)}
              disabled={pagination.page >= pagination.totalPages || isLoading}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}