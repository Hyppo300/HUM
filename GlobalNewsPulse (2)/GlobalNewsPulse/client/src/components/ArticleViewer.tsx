import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Article as BaseArticle } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
// Extended Article type that includes the content property
// from NewsAPI articles when they come directly from Flask
interface Article extends BaseArticle {
  content?: string;
}
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  MessageCircle,
  Send,
  Wand2,
  Brain,
  ListChecks,
  Share,
  Radio,
  Newspaper,
  Bookmark,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
  MenubarSeparator,
} from "@/components/ui/menubar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ArticleViewerProps {
  article: Article | null;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ArticleVariants {
  socialPost: string;
  shortForm: string;
  newsChannel: string;
}

interface SentimentAnalysis {
  sentiment: string;
  objectivity: number;
  keyThemes: string[];
  potentialBias: string;
}

export function ArticleViewer({ article, onClose }: ArticleViewerProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("read"); // For tabs: read, variants, analyze
  const { toast } = useToast();
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // States for AI-generated content
  const [variants, setVariants] = React.useState<ArticleVariants | null>(null);
  const [sentiment, setSentiment] = React.useState<SentimentAnalysis | null>(
    null,
  );
  const [variantsLoading, setVariantsLoading] = React.useState(false);
  const [sentimentLoading, setSentimentLoading] = React.useState(false);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to generate article variants (social, short-form, broadcast)
  const generateVariants = async () => {
    if (!article) return;

    setVariantsLoading(true);

    try {
      const response = await fetch("/api/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: article.title,
          content:
            article.aiEnhancedContent ||
            article.content ||
            article.originalContent,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate variants");

      const data = await response.json();
      setVariants(data);

      // Automatically switch to variants tab when data is ready
      setActiveTab("variants");

      toast({
        title: "Variants Generated",
        description: "Article has been transformed into different formats",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate article variants",
        variant: "destructive",
      });
    } finally {
      setVariantsLoading(false);
    }
  };

  // Function to analyze article sentiment and tone
  const analyzeArticle = async () => {
    if (!article) return;

    setSentimentLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            article.aiEnhancedContent ||
            article.content ||
            article.originalContent,
        }),
      });

      if (!response.ok) throw new Error("Failed to analyze article");

      const data = await response.json();
      setSentiment(data);

      // Automatically switch to analyze tab when data is ready
      setActiveTab("analyze");

      toast({
        title: "Analysis Complete",
        description: "Article sentiment and tone have been analyzed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze article sentiment",
        variant: "destructive",
      });
    } finally {
      setSentimentLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !article) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context:
            article.aiEnhancedContent ||
            article.content ||
            article.originalContent,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get response from AI",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIAction = async (action: string) => {
    if (!article) return;

    setIsLoading(true);
    let prompt = "";

    switch (action) {
      case "explain":
        prompt =
          "Please explain the main concepts and key points of this article in simple terms.";
        break;
      case "analyze":
        prompt =
          "Please provide a detailed analysis of this article, including its implications and potential impact.";
        break;
      case "factcheck":
        prompt =
          "Please identify and verify the key claims and facts presented in this article.";
        break;
      case "summarize":
        prompt =
          "Please provide a concise summary of this article highlighting the most important points.";
        break;
    }

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt,
          context:
            article.aiEnhancedContent ||
            article.content ||
            article.originalContent,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!article) return null;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Back button */}
      <Button variant="outline" className="mb-4" onClick={onClose}>
        Back to Articles
      </Button>
      {/* <Button variant="outline" className="mb-4" style={{ float: "right" }}>
        Select Language
      </Button> */}
      {/* Main layout - article and chat side by side */}
      <div className=" bg-[url(https://static.vecteezy.com/system/resources/thumbnails/035/328/612/small/red-silk-fabric-texture-used-as-background-red-panne-fabric-background-of-soft-and-smooth-textile-material-crushed-velvet-luxury-scarlet-for-velvet-photo.jpg)] w-full  bg-cover bg-center bg-no-repeat  grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[700px]">
        {/* Article Content with Tabs for different views */}
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle style={{ color: "#360302", paddingBottom: "20px" }}>
                  {decodeHtmlEntities(article.title)}
                </CardTitle>

                <div className="text-sm text-muted-foreground flex flex-wrap justify-between items-start gap-4 sm:gap-10">
                  <div className="mt-2">
                    {format(new Date(article.createdAt), "MMM d, yyyy")}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateVariants}
                      disabled={variantsLoading}
                      className="flex items-center gap-1"
                    >
                      <Share className="h-4 w-4" />
                      {variantsLoading ? "Generating..." : "Generate Variants"}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={analyzeArticle}
                      disabled={sentimentLoading}
                      className="flex items-center gap-1"
                    >
                      <Brain className="h-4 w-4" />
                      {sentimentLoading ? "Analyzing..." : "Analyze"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateVariants}
                  disabled={variantsLoading}
                  className="flex items-center gap-1"
                >
                  <Share className="h-4 w-4" />
                  {variantsLoading ? "Generating..." : "Generate Variants"}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={analyzeArticle}
                  disabled={sentimentLoading}
                  className="flex items-center gap-1"
                >
                  <Brain className="h-4 w-4" />
                  {sentimentLoading ? "Analyzing..." : "Analyze"}
                </Button>
              </div> */}
            </div>
          </CardHeader>

          <CardContent className="pt-2">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="read">Read Article</TabsTrigger>
                <TabsTrigger value="variants" disabled={!variants}>
                  Content Variants
                </TabsTrigger>
                <TabsTrigger value="analyze" disabled={!sentiment}>
                  Analysis
                </TabsTrigger>
              </TabsList>

              {/* Original Article Content */}
              <TabsContent value="read" className="mt-4">
                <ScrollArea className="h-[550px]">
                  <div className="prose prose-sm max-w-none">
                    {article.aiEnhancedContent ||
                    article.content ||
                    article.originalContent ? (
                      <ReactMarkdown>
                        {decodeHtmlEntities(
                          article.aiEnhancedContent ||
                            article.content ||
                            article.originalContent ||
                            "",
                        )}
                      </ReactMarkdown>
                    ) : (
                      <div className="p-4 text-center border border-dashed rounded-md my-8 text-muted-foreground">
                        <p className="mb-2">📰 AI-Enhanced News Content</p>
                        <p className="text-sm">
                          Click the "Generate Variants" button to create
                          enhanced versions of this article using AI.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Article Variants */}
              <TabsContent value="variants" className="mt-4">
                <ScrollArea className="h-[550px]">
                  {variants ? (
                    <div className="space-y-6">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2 text-black">
                            <Share className="h-4 w-4" />
                            Social Media Post
                          </CardTitle>
                          <CardDescription>
                            Condensed post for social media platforms
                          </CardDescription>
                        </CardHeader>
                        <CardContent style={{ color: "black" }}>
                          <div className="p-4 bg-muted rounded-md">
                            <ReactMarkdown>{variants.socialPost}</ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-black flex items-center gap-2">
                            <Newspaper className="h-4 w-4" />
                            Short-Form Summary
                          </CardTitle>
                          <CardDescription className="text-black">
                            Bullet-point summary of key information
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="text-black p-4 bg-muted rounded-md whitespace-pre-line">
                            <ReactMarkdown>{variants.shortForm}</ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2 text-black">
                            <Radio className="h-4 w-4" />
                            Broadcast Script
                          </CardTitle>
                          <CardDescription className="text-black">
                            Script formatted for news broadcast
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="text-black">
                          <div className="p-4 bg-muted rounded-md">
                            <ReactMarkdown>
                              {variants.newsChannel}
                            </ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-muted-foreground">
                      <p>
                        Click "Generate Variants" to create alternative formats
                        of this article
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Sentiment Analysis */}
              <TabsContent value="analyze" className="mt-4">
                <ScrollArea className="h-[550px]">
                  {sentiment ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-black">
                              Sentiment
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-red-800">
                            <div className="text-2xl font-bold text-center p-4">
                              {sentiment.sentiment}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="text-black">
                              Objectivity Score
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="text-red-800">
                            <div className="text-2xl font-bold text-center p-4">
                              {sentiment.objectivity}/10
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-black">
                            Key Themes
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-2 text-red-800">
                            {sentiment.keyThemes.map((theme, i) => (
                              <div
                                key={i}
                                className="px-3 py-1 bg-primary/10 rounded-full text-sm"
                              >
                                {theme}
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-black">
                            Potential Bias
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="p-4 bg-muted rounded-md text-red-800">
                            {sentiment.potentialBias}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-muted-foreground">
                      <p>
                        Click "Analyze" to evaluate sentiment and content themes
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-black">
                Chat about this article
              </CardTitle>
              <Menubar>
                <MenubarMenu>
                  <MenubarTrigger className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    AI Assist
                  </MenubarTrigger>
                  <MenubarContent>
                    <MenubarItem onClick={() => handleAIAction("explain")}>
                      <Brain className="h-4 w-4 mr-2" />
                      Explain Concepts
                    </MenubarItem>
                    <MenubarItem onClick={() => handleAIAction("analyze")}>
                      <ListChecks className="h-4 w-4 mr-2" />
                      Analyze Article
                    </MenubarItem>
                    <MenubarItem onClick={() => handleAIAction("factcheck")}>
                      <ListChecks className="h-4 w-4 mr-2" />
                      Fact Check
                    </MenubarItem>
                    <MenubarItem onClick={() => handleAIAction("summarize")}>
                      <ListChecks className="h-4 w-4 mr-2" />
                      Summarize
                    </MenubarItem>
                  </MenubarContent>
                </MenubarMenu>
              </Menubar>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col h-[600px]">
            <ScrollArea className="flex-1 pr-4 mb-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground p-4">
                  <p className="mb-2">Ask questions about this article</p>
                  <p className="text-sm">
                    Try the AI Assist menu for preset actions
                  </p>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <Card
                    key={i}
                    className={`mb-4 ${msg.role === "assistant" ? "bg-muted" : ""}`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-black">
                        <MessageCircle className="w-4 h-4 text-black" />
                        {msg.role === "assistant" ? "AI Assistant" : "You"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 prose prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </CardContent>
                  </Card>
                ))
              )}
              <div ref={chatEndRef} />
            </ScrollArea>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about the article..."
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                style={{ backgroundColor: "red" }}
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
