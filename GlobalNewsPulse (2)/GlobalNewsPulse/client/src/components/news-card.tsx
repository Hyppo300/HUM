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
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 bg-white border-0">
      <div className="aspect-[16/9] overflow-hidden bg-muted">
        <img 
          src={article.imageUrl || 'https://placehold.co/800x450/e5e7eb/a1a1aa?text=News'} 
          alt={article.title}
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
        />
      </div>
      <CardHeader className="space-y-2 pt-6">
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>{format(new Date(article.createdAt), "MMM d, yyyy")}</span>
          <span className="uppercase font-medium">
            {article.country?.endsWith("-TRENDING") ? article.country.replace("-TRENDING", "") : article.country}
          </span>
          {(article.country === "GLOBAL-TRENDING" || article.country?.endsWith("-TRENDING")) && (
            <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-medium">
              🔥 Trending
            </span>
          )}
        </div>
        <CardTitle className="line-clamp-2 text-xl font-semibold group-hover:text-primary transition-colors">
          {decodeHtmlEntities(article.title)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground/90 line-clamp-3 mb-6">
          {decodeHtmlEntities(article.summary)}
        </p>
        <Link 
          href={`/article/${article.id}`}
          className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Read More
          <ExternalLink className="ml-2 h-4 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}