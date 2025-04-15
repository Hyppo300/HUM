import { Article } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Link } from "wouter";

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  const entities: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&#039;': "'",
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&nbsp;': ' '
  };

  // Replace all known entities
  let decodedText = text;
  for (const [entity, replacement] of Object.entries(entities)) {
    decodedText = decodedText.replace(new RegExp(entity, 'g'), replacement);
  }

  // Handle numeric entities like &#123;
  decodedText = decodedText.replace(/&#(\d+);/g, (_, dec) => {
    return String.fromCharCode(parseInt(dec, 10));
  });

  return decodedText;
}

interface NewsCardProps {
  article: Article;
}

export function NewsCard({ article }: NewsCardProps) {
  return (
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 bg-primary/10 border-primary/20 hover:bg-primary/15">
      <CardHeader className="space-y-2 pt-6 bg-secondary/10">
        <CardTitle className="line-clamp-2 text-lg font-semibold">
          {decodeHtmlEntities(article.title)}
        </CardTitle>
        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{format(new Date(article.createdAt), "MMM d, yyyy")}</span>
          <span className="text-muted-foreground/30">•</span>
          <span className="uppercase text-xs font-medium">
            {article.country?.endsWith("-TRENDING") ? article.country.replace("-TRENDING", "") : article.country}
          </span>

          {(article.country === "GLOBAL-TRENDING" || article.country?.endsWith("-TRENDING")) && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-xs bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-sm font-medium flex items-center">
                🔥 Trending
              </span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {decodeHtmlEntities(article.summary)}
        </p>
        <Link 
          href={`/article/${article.id}`}
          className="inline-flex items-center text-sm text-primary hover:text-primary/80 transition-colors"
        >
          Read full article
          <ExternalLink className="ml-1 h-3 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}