import { Article } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Link } from "wouter";

// Function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  if (!text) return "";

  const entities: Record<string, string> = {
    "&quot;": '"',
    "&apos;": "'",
    "&#039;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&nbsp;": " ",
  };

  // Replace all known entities
  let decodedText = text;
  for (const [entity, replacement] of Object.entries(entities)) {
    decodedText = decodedText.replace(new RegExp(entity, "g"), replacement);
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
    <Card className="group overflow-hidden hover:shadow-xl transition-all duration-300 bg-gray-300 text-foreground border-primary/20 font-opensans  mx-4 sm:mx-0 mb-6">
      <CardHeader className="space-y-2 pt-4 ">
        <CardTitle className="line-clamp-2 text-lg font-semibold">
          <span
            className="uppercase text-xs font-medium "
            style={{
              background: "rgb(118 10 8)",
              paddingBlock: "12px",
              paddingInline: "10px",
              color: "white",

              fontWeight: "700",
            }}
          >
            {article.country?.endsWith("-TRENDING")
              ? article.country.replace("-TRENDING", "")
              : article.country}
          </span>
          {(article.country === "GLOBAL-TRENDING" ||
            article.country?.endsWith("-TRENDING")) && (
            <>
              <span
                className="text-xs text-red-700 px-1.5 py-0.5 rounded-sm font-medium flex-right items-center"
                style={{ marginLeft: "5%" }}
              >
                🔥 Trending
              </span>
            </>
          )}
        </CardTitle>

        {/* <CardTitle className="line-clamp-2 text-lg font-semibold">
          {decodeHtmlEntities(article.title)}
        </CardTitle>
        <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
          <span>{format(new Date(article.createdAt), "MMM d, yyyy")}</span>
          <span className="text-muted-foreground/30">•</span>
          <span className="uppercase text-xs font-medium">
            {article.country?.endsWith("-TRENDING")
              ? article.country.replace("-TRENDING", "")
              : article.country}
          </span>

          {(article.country === "GLOBAL-TRENDING" ||
            article.country?.endsWith("-TRENDING")) && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-xs bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded-sm font-medium flex items-center">
                🔥 Trending
              </span>
            </>
          )}
        </div> */}
      </CardHeader>
      <CardContent className="">
        <CardTitle
          className="line-clamp-2 text-lg font-semibold font-opensans"
          style={{ paddingBottom: "10px" }}
        >
          {decodeHtmlEntities(article.title)}
        </CardTitle>

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            marginBottom: "5px",
            fontSize: "small",
          }}
        >
          <img
            src="https://cdn3.iconfinder.com/data/icons/flaticons-1/24/flaticon_clock1-512.png"
            style={{ width: "12px", marginRight: "5px" }}
          ></img>
          {format(new Date(article.createdAt), "MMM d, yyyy")}
        </span>

        <span
          style={{
            display: "block",
            width: "100%",
            borderTop: " 1px solid rgb(118 10 8)",
            marginBottom: "10px",
            marginTop: "5px",
          }}
        ></span>
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
          {decodeHtmlEntities(article.summary)}
        </p>
        <Link
          href={`/article/${article.id}`}
          className="inline-flex items-center text-red-800 text-sm hover:text-red-500 transition-colors"
        >
          Read Full Article
          <ExternalLink className="ml-1 h-3 w-4" />
        </Link>
      </CardContent>
    </Card>
  );
}
