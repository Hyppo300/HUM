import { useQuery, useMutation } from "@tanstack/react-query";
import { Article } from "@shared/schema";
import { NewsFeed } from "@/components/news-feed";
import { CountryFilter } from "@/components/country-filter";
import { UserMenuSection } from "@/components/user-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Globe, Flame, MapPin, X } from "lucide-react";
import { useState, FormEvent, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function HomePage() {
  const [selectedCountry, setSelectedCountry] = useState<string>();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Manually fetch articles on initial load - no automatic fetching
  const [articles, setArticles] = useState<Article[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<{
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }>({ page: 1, pageSize: 30, totalCount: 0, totalPages: 0 });

  // Load articles with pagination support
  const loadArticles = async (page = 1, country?: string) => {
    try {
      // Create URL with pagination parameters
      const url = `/api/articles?page=${page}&pageSize=30${country ? `&country=${country}` : ""}`;

      // Debug country filter
      if (country) {
        console.log(`Loading articles with country filter: ${country}`);
      }

      // Use direct fetch to avoid React Query altogether
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();

        // Debug response
        console.log(
          `Received ${data.articles?.length || 0} articles from API with country: ${country || "none"}`,
        );
        if (country && data.articles && data.articles.length > 0) {
          console.log(
            `First article country: ${data.articles[0].country}, id: ${data.articles[0].id}`,
          );
        }

        setArticles(data.articles || []);
        setPagination(
          data.pagination || {
            page: 1,
            pageSize: 30,
            totalCount: 0,
            totalPages: 0,
          },
        );
      }
    } catch (error) {
      console.error("Error loading articles:", error);
    }
  };

  // Load articles once on initial page load - no automatic fetching
  useEffect(() => {
    // Load articles once on mount
    loadArticles(1, selectedCountry);
  }, []);

  // Keep track of dynamically loaded articles from NewsAPI
  const [newsApiArticles, setNewsApiArticles] = useState<Article[]>([]);

  // Keep track of articles from Newsroom API
  const [newsroomArticles, setNewsroomArticles] = useState<Article[]>([]);

  // Track active filters
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);

  // Handle page changes for pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    loadArticles(page, selectedCountry);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Effect to handle country filter changes - runs when country is changed
  useEffect(() => {
    console.log(`Country filter changed to: ${selectedCountry || "cleared"}`);

    // Clear previous API articles when country changes
    setNewsApiArticles([]);

    // Reset to page 1 when changing country
    setCurrentPage(1);

    if (selectedCountry) {
      // Set filter to country mode
      setActiveFilter("country");

      // Load articles with the new country filter
      loadArticles(1, selectedCountry);
    } else {
      // When filter is cleared, set to 'all' and load without country filter
      setActiveFilter("all");
      loadArticles(1);
    }
  }, [selectedCountry]);

  // Combine all sources of articles into one unified feed
  const allArticles = [
    ...(articles || []),
    ...newsApiArticles,
    ...newsroomArticles,
  ];

  // Filter articles based on activeFilter
  useEffect(() => {
    // Get all articles from all sources in one unified feed
    const baseArticles = [
      ...(articles || []),
      ...newsApiArticles,
      ...newsroomArticles,
    ];

    // Apply filters
    let filtered: Article[] = [];

    switch (activeFilter) {
      case "all":
        // No filtering, show all articles
        filtered = baseArticles;
        break;
      case "hot":
        // Filter strictly for trending or hot topics only
        filtered = baseArticles.filter(
          (article) =>
            article.country === "GLOBAL-TRENDING" || // Global trending articles
            article.country?.endsWith("-TRENDING") || // Country-specific trending (like "US-TRENDING")
            article.title.toLowerCase().includes("trending") ||
            article.title.toLowerCase().includes("hot topic") ||
            article.title.toLowerCase().includes("breaking") ||
            article.category === "trending",
        );

        // Only add the most recent news articles as a fallback if nothing is truly trending
        if (filtered.length === 0) {
          // Add articles that contain keywords related to trending news
          const trendingKeywords = ["latest", "just in", "update", "new"];

          // First attempt: Look for articles with trending-related keywords
          filtered = baseArticles.filter((article) => {
            const title = article.title.toLowerCase();
            const summary = article.summary?.toLowerCase() || "";

            return trendingKeywords.some(
              (keyword) => title.includes(keyword) || summary.includes(keyword),
            );
          });
        }
        break;
      case "global":
        // Filter for global news (articles with GLOBAL country or trending news)
        filtered = baseArticles.filter(
          (article) =>
            article.country === "GLOBAL" ||
            article.country === "global" ||
            article.country === "GLOBAL-TRENDING" ||
            article.country?.endsWith("-TRENDING"), // Include country-specific trending news in global view
        );
        break;
      case "search":
        // Filter by search query
        if (searchQuery) {
          filtered = baseArticles.filter(
            (article) =>
              article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              article.summary
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              article.aiEnhancedContent
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()),
          );
        } else {
          filtered = baseArticles;
        }
        break;
      case "country":
        // Filter by selected country
        if (selectedCountry) {
          console.log(
            `Filtering articles client-side for country: ${selectedCountry}`,
          );

          // Special case for GLOBAL to match multiple values
          if (selectedCountry.toUpperCase() === "GLOBAL") {
            filtered = baseArticles.filter(
              (article) =>
                article.country?.toUpperCase() === "GLOBAL" ||
                article.country?.toUpperCase() === "GLOBAL-TRENDING",
            );
          } else {
            // Case-insensitive match for specific countries
            filtered = baseArticles.filter(
              (article) =>
                article.country?.toUpperCase() ===
                selectedCountry.toUpperCase(),
            );
          }

          console.log(
            `Found ${filtered.length} articles for country ${selectedCountry}`,
          );
        } else {
          filtered = baseArticles;
        }
        break;
      default:
        filtered = baseArticles;
    }

    setFilteredArticles(filtered);
  }, [
    activeFilter,
    articles,
    newsApiArticles,
    newsroomArticles,
    searchQuery,
    selectedCountry,
  ]);

  // Fetch news by country mutation
  const fetchNewsMutation = useMutation({
    mutationFn: async ({
      country,
      query,
      trending,
    }: {
      country?: string;
      query?: string;
      trending?: boolean;
    }) => {
      // Fetch from our Express proxy endpoint to avoid CORS issues
      try {
        // Use the proxy endpoint on our Express server instead of direct Flask connection
        let url = "/api/proxy-news?page_size=30";

        // Add parameters to URL if provided
        if (country) url += `&country=${country}`;
        if (query) url += `&query=${encodeURIComponent(query)}`;
        // TypeScript fix: Need to check if trending exists and is true
        if (trending === true) url += `&trending=true`;

        console.log(`Fetching news from proxy: ${url}`);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          // Add a short timeout to prevent long-hanging requests
          signal: AbortSignal.timeout(30000), // Increased timeout to 30 seconds
        });

        if (!response.ok) {
          let errorMessage = "Failed to fetch news";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            // If we can't parse the error as JSON, use the status text
            errorMessage = `${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // New handling for direct response from Flask server
        // Check if the response contains articles array directly from Flask
        if (data && data.articles && Array.isArray(data.articles)) {
          console.log(
            `Received ${data.articles.length} articles directly from Flask server`,
          );

          // If no articles were returned, we'll continue silently without showing a notification
          // This keeps backend processes invisible to the user
          if (data.articles.length === 0) {
            console.log("No articles found from API, but continuing silently");

            // Return early without updating the state
            return {
              message: "No articles found",
              directArticles: true,
              articles: [],
            };
          }

          // Transform the articles to match the expected format
          const transformedArticles = data.articles.map(
            (article: any, index: number) => {
              const articleId = 1000 + index; // Generate sequential IDs starting from 1000 to avoid conflicts with local articles
              const transformedArticle = {
                id: articleId,
                title: article.title || "Untitled Article",
                summary: article.description || article.summary || "",
                aiEnhancedContent: article.content || article.description || "", // Use content as aiEnhancedContent
                country: article.country || "GLOBAL",
                category: article.category || "general",
                sourceUrl: article.url || article.sourceUrl || "#",
                sourceApi: "NewsAPI",
                originalContent: article.description || "",
                originalJson: JSON.stringify(article),
                createdAt: article.publishedAt
                  ? new Date(article.publishedAt).toISOString()
                  : new Date().toISOString(),
                authorId: null,
              };

              // Store each article in sessionStorage for retrieval in article page
              try {
                // Store it with key pattern "article-{id}"
                sessionStorage.setItem(
                  `article-${articleId}`,
                  JSON.stringify(transformedArticle),
                );
              } catch (e) {
                console.error("Failed to store article in sessionStorage:", e);
              }

              // Log for debugging
              console.log("Transformed article:", {
                title: transformedArticle.title,
                hasContent: !!article.content,
                contentLength: article.content ? article.content.length : 0,
              });

              return transformedArticle;
            },
          );

          console.log(
            `Transformed ${transformedArticles.length} articles for display`,
          );

          // Instead of overwriting the existing articles, store them in our local state
          setNewsApiArticles(transformedArticles);

          // Return a success message
          return {
            message: `Successfully fetched ${data.articles.length} articles`,
            directArticles: true,
            articles: transformedArticles,
          };
        }

        // If we don't get the direct articles format, continue with original flow
        return data;
      } catch (error: any) {
        console.error("Error fetching news:", error);

        // Handle timeout specifically (a common issue with trending news)
        if (
          error?.name === "TimeoutError" ||
          (error?.message &&
            typeof error.message === "string" &&
            error.message.includes("timeout"))
        ) {
          // For trending news, we can fall back to the /api/articles endpoint since we have sample data
          if (trending === true) {
            console.log("Timeout for trending news, using existing articles");
            return { message: "Using existing articles as trending" };
          }
        }

        throw error;
      }
    },
    onSuccess: (data) => {
      // Check if the articles were already stored directly in the cache
      // If not, invalidate the query to trigger a refetch
      if (!data.directArticles) {
        queryClient.invalidateQueries({ queryKey: ["/api/articles"] });
      }

      // No toast notification for news updates to keep backend processes invisible

      setIsSearching(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch news",
        variant: "destructive",
      });
      setIsSearching(false);
    },
  });

  // Handle fetching news by country
  const handleFetchNews = () => {
    // Don't perform the fetch if it's already in progress
    if (fetchNewsMutation.isPending) return;

    if (selectedCountry) {
      // If a country is selected, fetch news for that country
      fetchNewsMutation.mutate({
        country: selectedCountry,
        query: undefined,
      });

      toast({
        title: `Fetching ${selectedCountry.toUpperCase()} News`,
        description: "Getting the latest articles from this country...",
      });

      // Make sure we're in country filter mode
      setActiveFilter("country");
    } else {
      // If no country is selected, fetch trending global news
      // as this is more useful than fetching with no parameters
      fetchNewsMutation.mutate({
        trending: true,
        query: "breaking news",
      });

      toast({
        title: "Fetching Global News",
        description: "Getting the latest headlines from around the world...",
      });

      // Set to hot topics mode
      setActiveFilter("hot");
    }
  };

  // Enable background fetching on initial load with cycling through all 55 countries
  useEffect(() => {
    // Allow background fetching
    window._disableAllAutoFetching = false;

    // Complete list of 55 countries as provided by the user
    const countries = [
      "ae", // United Arab Emirates
      "ar", // Argentina
      "at", // Austria
      "au", // Australia
      "be", // Belgium
      "bg", // Bulgaria
      "br", // Brazil
      "ca", // Canada
      "ch", // Switzerland
      "cn", // China
      "co", // Colombia
      "cu", // Cuba
      "cz", // Czech Republic
      "de", // Germany
      "eg", // Egypt
      "fr", // France
      "gb", // United Kingdom
      "gr", // Greece
      "hk", // Hong Kong
      "hu", // Hungary
      "id", // Indonesia
      "ie", // Ireland
      "il", // Israel
      "in", // India
      "it", // Italy
      "jp", // Japan
      "kr", // South Korea
      "lt", // Lithuania
      "lv", // Latvia
      "ma", // Morocco
      "mx", // Mexico
      "my", // Malaysia
      "ng", // Nigeria
      "nl", // Netherlands
      "no", // Norway
      "nz", // New Zealand
      "ph", // Philippines
      "pl", // Poland
      "pt", // Portugal
      "ro", // Romania
      "rs", // Serbia
      "ru", // Russia
      "sa", // Saudi Arabia
      "se", // Sweden
      "sg", // Singapore
      "si", // Slovenia
      "sk", // Slovakia
      "th", // Thailand
      "tr", // Turkey
      "tw", // Taiwan
      "ua", // Ukraine
      "us", // United States
      "ve", // Venezuela
      "za", // South Africa
    ];

    // Keep track of which country index we're on
    let countryIndex = 0;

    // Set up a background task to fetch news periodically
    const backgroundFetchInterval = setInterval(() => {
      // Only run if not already fetching
      if (!fetchNewsMutation.isPending) {
        // Get the next country in the rotation
        const country = countries[countryIndex];
        countryIndex = (countryIndex + 1) % countries.length;

        console.log(
          `Background fetch initiated for ${country.toUpperCase()} news content`,
        );

        // Fetch news in the background without showing loading state
        fetchNewsMutation.mutate({
          country: country,
          query: undefined,
        });
      }

      // Also fetch from Newsroom API occasionally
      if (!fetchNewsroomMutation.isPending && countryIndex % 5 === 0) {
        console.log("Background fetch initiated for Newsroom content");
        fetchNewsroomMutation.mutate();
      }
    }, 60000); // Every minute (as requested by the user)

    // Clean up interval on unmount
    return () => clearInterval(backgroundFetchInterval);
  }, []);

  // Handle search form submission
  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Set filter to search mode
    setActiveFilter("search");

    setIsSearching(true);
    toast({
      title: "Searching News",
      description: `Showing results for "${searchQuery}"...`,
    });

    // Also fetch new search results in the background
    if (!fetchNewsMutation.isPending) {
      fetchNewsMutation.mutate({ query: searchQuery });
    }
  };

  // Handle fetching trending news from around the world
  const handleFetchTrendingNews = () => {
    try {
      // Set filter to hot topics
      setActiveFilter("hot");

      toast({
        title: "Showing Global Hot Topics",
        description: "Displaying trending news from around the world...",
      });

      // Define a set of strategically selected countries for trending news
      const trendingCountries = [
        "us",
        "gb",
        "in",
        "fr",
        "jp",
        "au",
        "ae",
        "za",
      ];

      // Fetch from the first country immediately
      if (!fetchNewsMutation.isPending) {
        // Call with global trending flag
        fetchNewsMutation.mutate({
          country: "GLOBAL-TRENDING", // Special flag for global trending
          query: "trending hot breaking global news", // Use specific trending keywords
          trending: true,
        });
      }

      // Set up sequential fetching of trending news from multiple countries
      let countryIndex = 0;
      const fetchNextTrendingCountry = () => {
        if (countryIndex < trendingCountries.length) {
          const country = trendingCountries[countryIndex];
          console.log(`Fetching trending news from ${country.toUpperCase()}`);

          // Fetch trending news from this country
          fetchNewsMutation.mutate({
            country,
            query: "trending breaking news",
            trending: true,
          });

          countryIndex++;

          // Schedule the next country fetch
          setTimeout(fetchNextTrendingCountry, 8000); // 8 seconds apart
        }
      };

      // Start the sequential trending fetch process after a short delay
      setTimeout(fetchNextTrendingCountry, 3000);
    } catch (error) {
      console.error("Error in fetch operation:", error);
      toast({
        title: "Error",
        description: "Failed to fetch trending news",
        variant: "destructive",
      });
    }
  };

  // Handle fetching global news by cycling through multiple countries
  const handleFetchGlobalNews = () => {
    try {
      // Set filter to global news
      setActiveFilter("global");

      toast({
        title: "Showing Global News",
        description: "Displaying news from around the world...",
      });

      // Define a set of diverse countries from different continents for truly global coverage
      const globalCountries = [
        "gb",
        "in",
        "au",
        "za",
        "jp",
        "sg",
        "fr",
        "br",
        "ar",
        "cn",
        "eg",
        "de",
        "id",
        "mx",
        "ru",
        "ae",
        "th",
        "kr",
        "sa",
        "ng",
        "tr",
        "it",
        "pl",
        "ca",
      ];

      // Fetch from the first country immediately
      if (!fetchNewsMutation.isPending) {
        fetchNewsMutation.mutate({
          country: globalCountries[0],
        });
      }

      // Set up sequential fetching of global news from multiple countries
      // This happens invisibly in the background
      let countryIndex = 1;
      const fetchNextCountry = () => {
        if (countryIndex < globalCountries.length) {
          const country = globalCountries[countryIndex];
          console.log(`Fetching global news from ${country.toUpperCase()}`);

          fetchNewsMutation.mutate({ country });
          countryIndex++;

          // Schedule the next country fetch
          setTimeout(fetchNextCountry, 10000); // 10 seconds apart
        }
      };

      // Start the sequential global fetch process after a short delay
      setTimeout(fetchNextCountry, 5000);

      console.log("Filtering for global news articles");
    } catch (error) {
      console.error("Error fetching global news:", error);
      toast({
        title: "Error",
        description: "Failed to display global news",
        variant: "destructive",
      });
    }
  };

  // Fetch from Newsroom API mutation
  const fetchNewsroomMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log("Fetching news from Newsroom API");

        const response = await fetch("/api/proxy-newsroom", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
          let errorMessage = "Failed to fetch from Newsroom API";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();

        // Check if the response contains articles
        if (data && data.articles && Array.isArray(data.articles)) {
          console.log(
            `Received ${data.articles.length} articles from Newsroom API`,
          );

          // If no articles were returned, continue silently without notification
          if (data.articles.length === 0) {
            console.log(
              "No articles found from Newsroom API, continuing silently",
            );

            return {
              message: "No articles found",
              directArticles: true,
              articles: [],
            };
          }

          // Transform the articles to match the expected format
          const transformedArticles = data.articles.map(
            (article: any, index: number) => {
              const articleId = 2000 + index; // Start from 2000 to avoid conflicts
              const transformedArticle = {
                id: articleId,
                title: article.title || "Untitled Article",
                summary: article.description || article.summary || "",
                aiEnhancedContent: article.content || article.description || "",
                country: article.country || "PK", // Default to Pakistan for Newsroom
                category: article.category || "general",
                sourceUrl: article.url || article.sourceUrl || "#",
                sourceApi: "Newsroom API",
                originalContent: article.description || "",
                originalJson: JSON.stringify(article),
                createdAt: article.publishedAt
                  ? new Date(article.publishedAt).toISOString()
                  : new Date().toISOString(),
                authorId: null,
              };

              // Store each article in sessionStorage for retrieval in article page
              try {
                sessionStorage.setItem(
                  `article-${articleId}`,
                  JSON.stringify(transformedArticle),
                );
              } catch (e) {
                console.error(
                  "Failed to store Newsroom article in sessionStorage:",
                  e,
                );
              }

              return transformedArticle;
            },
          );

          console.log(
            `Transformed ${transformedArticles.length} Newsroom articles for display`,
          );

          // Store the newsroom articles in our local state
          setNewsroomArticles(transformedArticles);

          // Return a success message
          return {
            message: `Successfully fetched ${data.articles.length} articles from Newsroom`,
            directArticles: true,
            articles: transformedArticles,
          };
        }

        return data;
      } catch (error: any) {
        console.error("Error fetching from Newsroom API:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // No toast notification for Newsroom updates to keep backend processes invisible
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch from Newsroom API",
        variant: "destructive",
      });
    },
  });

  // Handle fetching from Newsroom API
  const handleFetchNewsroom = () => {
    if (fetchNewsroomMutation.isPending) return;

    setNewsroomArticles([]); // Clear previous articles
    fetchNewsroomMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-black sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-white">
              Global News Hub
            </h1>
            <div className="flex items-center gap-4">
              <CountryFilter
                value={selectedCountry}
                onChange={(country) => {
                  setSelectedCountry(country);
                  if (country) {
                    // Set filter to country mode
                    setActiveFilter("country");
                    toast({
                      title: `Showing ${country.toUpperCase()} News`,
                      description: `Displaying articles from ${country.toUpperCase()}...`,
                    });

                    // Automatically fetch news for this country in the background
                    if (!fetchNewsMutation.isPending) {
                      console.log(
                        `Auto-fetching news for ${country.toUpperCase()}`,
                      );
                      // Fetch news without showing loading state
                      fetchNewsMutation.mutate({
                        country: country,
                        query: undefined,
                      });
                    }
                  } else {
                    // Reset to show all
                    setActiveFilter("all");
                  }
                }}
              />
              <UserMenuSection />
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b bg-background sticky top-16 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center overflow-x-auto no-scrollbar py-2 gap-6">
            <a href="#world" className="text-sm font-medium hover:text-primary whitespace-nowrap">World</a>
            <a href="#politics" className="text-sm font-medium hover:text-primary whitespace-nowrap">Politics</a>
            <a href="#business" className="text-sm font-medium hover:text-primary whitespace-nowrap">Business</a>
            <a href="#health" className="text-sm font-medium hover:text-primary whitespace-nowrap">Health</a>
            <a href="#entertainment" className="text-sm font-medium hover:text-primary whitespace-nowrap">Entertainment</a>
            <a href="#tech" className="text-sm font-medium hover:text-primary whitespace-nowrap">Tech</a>
            <a href="#style" className="text-sm font-medium hover:text-primary whitespace-nowrap">Style</a>
            <a href="#travel" className="text-sm font-medium hover:text-primary whitespace-nowrap">Travel</a>
            <a href="#sports" className="text-sm font-medium hover:text-primary whitespace-nowrap">Sports</a>
            <a href="#science" className="text-sm font-medium hover:text-primary whitespace-nowrap">Science</a>
            <a href="#climate" className="text-sm font-medium hover:text-primary whitespace-nowrap">Climate</a>
            <a href="#weather" className="text-sm font-medium hover:text-primary whitespace-nowrap">Weather</a>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="flex gap-4 w-full">
          <form onSubmit={handleSearch} className="flex gap-2 w-full">
            <Input
              type="text"
              placeholder="Search for news topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={fetchNewsMutation.isPending || !searchQuery.trim()}
              className="flex items-center gap-2"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </form>
          <div className="flex gap-2">
            <Button
              variant="default"
              onClick={handleFetchTrendingNews}
              disabled={fetchNewsMutation.isPending}
              className="whitespace-nowrap"
            >
              🔥 Hot Topics
            </Button>
          </div>
        </div>

        {/* We've removed the loading indicator to prevent showing fetch operations to users */}

        {/* Display filter indicator when a filter is active */}
        {activeFilter !== "all" && (
          <div className="border rounded-md bg-muted/20 p-2 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeFilter === "hot" && (
                <Flame className="h-4 w-4 text-red-500" />
              )}
              {activeFilter === "global" && (
                <Globe className="h-4 w-4 text-blue-500" />
              )}
              {activeFilter === "search" && (
                <Search className="h-4 w-4 text-purple-500" />
              )}
              {activeFilter === "country" && (
                <MapPin className="h-4 w-4 text-green-500" />
              )}

              <span className="text-sm text-muted-foreground">
                {activeFilter === "hot" &&
                  "Showing global hot topics and trending news from around the world"}
                {activeFilter === "global" && "Showing global news articles"}
                {activeFilter === "search" &&
                  `Search results for: "${searchQuery}"`}
                {activeFilter === "country" &&
                  `Showing news from ${selectedCountry?.toUpperCase()}`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveFilter("all")}
              className="text-xs"
            >
              <X className="h-3 w-3 mr-1" /> Clear Filter
            </Button>
          </div>
        )}

        {/* Combined unified news feed with all sources */}
        <NewsFeed
          articles={
            activeFilter === "all"
              ? [...(articles || []), ...newsApiArticles, ...newsroomArticles]
              : filteredArticles
          }
          isLoading={
            false
          } /* Never show loading state for immediate feedback */
          className="pt-4"
          pagination={pagination}
          onPageChange={handlePageChange}
        />

        {/* Only show this message if we truly have no articles after loading completes */}
        {((activeFilter === "all" &&
          articles?.length === 0 &&
          newsApiArticles.length === 0 &&
          newsroomArticles.length === 0 &&
          !isLoading) ||
          (activeFilter !== "all" && filteredArticles.length === 0)) && (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <p className="text-muted-foreground mb-4">
              {activeFilter === "all"
                ? "No articles found. Try selecting a different country or searching for a topic."
                : "No articles found matching your current filter. Try another filter or search term."}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setActiveFilter("all")}>
                Clear Filter
              </Button>
              <Button variant="outline" onClick={handleFetchNews}>
                Fetch More News
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}