import requests
import json
import os
import logging
from openai_utils import enhance_article

# Create logger as a substitute for flask's current_app.logger
logger = logging.getLogger(__name__)

NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")
EXPRESS_SERVER_URL = "http://localhost:5000/api/news/batch"

def fetch_news_articles(country="us", category=None, page_size=20, query=None, trending=False):
    """
    Fetch news articles from News API
    
    Args:
        country: Country code (default: us)
        category: Category (business, entertainment, general, health, science, sports, technology)
        page_size: Number of articles to fetch (default: 20)
        query: Search query term (if provided, uses /everything endpoint instead of /top-headlines)
        trending: If True, fetches trending/hot news. If country is specified, shows trending news for that country.
                 Otherwise, shows global trending news.
        
    Returns:
        Processed articles ready to be sent to Express server
    """
    if not NEWS_API_KEY:
        logger.error("NEWS_API_KEY not set")
        return {"error": "NEWS_API_KEY not set"}
    
    # Build the News API URL based on request type
    if trending:
        # For trending/hot news, use /top-headlines
        url = "https://newsapi.org/v2/top-headlines"
        params = {
            "apiKey": NEWS_API_KEY,
            "pageSize": page_size,
            "language": "en",   # English articles only
            "category": "general"  # General news tends to be trending
        }
        
        # If country is specified, use it for country-specific trending
        if country and country != "GLOBAL" and country != "GLOBAL-TRENDING":
            params["country"] = country
            country_used = f"{country}-TRENDING"
            logger.info(f"Fetching country-specific trending news for: {country}")
        else:
            # Global trending (no country filter)
            country_used = "GLOBAL-TRENDING"
            logger.info("Fetching global trending news (no country filter)")
        
    elif query:
        # Option 2: If a search query is provided, use the /everything endpoint
        # with sortBy=popularity to get most popular matching articles
        url = "https://newsapi.org/v2/everything"
        params = {
            "apiKey": NEWS_API_KEY,
            "q": query,
            "pageSize": page_size,
            "sortBy": "popularity",  # Get most popular matching results
            "language": "en"          # English articles only
        }
        
        # We're not using country with /everything endpoint
        country_used = "GLOBAL"
    else:
        # Option 3: Otherwise use top-headlines with country filter
        url = "https://newsapi.org/v2/top-headlines"
        params = {
            "apiKey": NEWS_API_KEY,
            "country": country,
            "pageSize": page_size
        }
        
        if category:
            params["category"] = category
        
        country_used = country
        
        # Create a fallback query for countries that might not be supported
        # by the top-headlines endpoint
        country_fallback_enabled = True  # Flag to enable/disable this feature
    
    try:
        # Make the request to News API
        response = requests.get(url, params=params)
        data = response.json()
        
        if response.status_code != 200:
            error_message = data.get('message', 'Unknown error')
            logger.error(f"Error fetching news: {error_message}")
            logger.error(f"Request URL: {url}")
            logger.error(f"Request Params: {params}")
            return {"error": f"Error fetching news: {error_message}"}
            
        # Process the articles
        articles = data.get("articles", [])
        processed_articles = []
        
        # Check if we got zero articles for a country query and need to try a fallback
        if len(articles) == 0 and url == "https://newsapi.org/v2/top-headlines" and country != "us" and not query:
            # Try with the /everything endpoint and the country name as a search term
            print(f"No articles found for country: {country}, trying fallback search")
            
            # Get the country name from the country code
            country_names = {
                "ar": "Argentina", "au": "Australia", "at": "Austria", "be": "Belgium", 
                "br": "Brazil", "bg": "Bulgaria", "ca": "Canada", "cn": "China", 
                "co": "Colombia", "cu": "Cuba", "cz": "Czech Republic", "eg": "Egypt", 
                "fr": "France", "de": "Germany", "gr": "Greece", "hk": "Hong Kong", 
                "hu": "Hungary", "in": "India", "id": "Indonesia", "ie": "Ireland", 
                "il": "Israel", "it": "Italy", "jp": "Japan", "lv": "Latvia", 
                "lt": "Lithuania", "my": "Malaysia", "mx": "Mexico", "ma": "Morocco", 
                "nl": "Netherlands", "nz": "New Zealand", "ng": "Nigeria", "no": "Norway", 
                "ph": "Philippines", "pl": "Poland", "pt": "Portugal", "ro": "Romania", 
                "ru": "Russia", "sa": "Saudi Arabia", "rs": "Serbia", "sg": "Singapore", 
                "sk": "Slovakia", "si": "Slovenia", "za": "South Africa", "kr": "South Korea", 
                "se": "Sweden", "ch": "Switzerland", "tw": "Taiwan", "th": "Thailand", 
                "tr": "Turkey", "ae": "UAE", "ua": "Ukraine", "gb": "United Kingdom", 
                "us": "United States", "ve": "Venezuela"
            }
            
            country_name = country_names.get(country.lower(), country)
            
            fallback_url = "https://newsapi.org/v2/everything"
            fallback_params = {
                "apiKey": NEWS_API_KEY,
                "q": country_name,
                "pageSize": page_size,
                "sortBy": "popularity",
                "language": "en"
            }
            
            print(f"Fallback search for {country_name}")
            
            try:
                fallback_response = requests.get(fallback_url, params=fallback_params)
                fallback_data = fallback_response.json()
                
                if fallback_response.status_code == 200:
                    articles = fallback_data.get("articles", [])
                    print(f"Fallback search found {len(articles)} articles for {country_name}")
            except Exception as e:
                print(f"Error in fallback search: {str(e)}")
                # Continue with original empty results
        
        for article in articles:
            # Ensure we have content
            if not article.get("content") and not article.get("description"):
                continue
                
            # Prepare the article data
            article_data = {
                "title": article.get("title", ""),
                "content": article.get("content", article.get("description", "")),
                "sourceUrl": article.get("url", ""),
                "source": article.get("source", {}).get("name", "Unknown"),
                "country": country_used.upper(),
                "category": category or "General",
                "rawData": json.dumps(article)
            }
            
            # Enhance article content using OpenAI
            try:
                # Use OpenAI to enhance the article content
                try:
                    from openai_utils import enhance_article
                    enhanced_data = enhance_article(article_data)
                    article_data.update(enhanced_data)
                    print(f"Enhanced article: {article_data['enhancedTitle']}")
                except Exception as e:
                    logger.error(f"Error enhancing article with OpenAI: {str(e)}")
                    # Fallback to simple enhancement if OpenAI fails
                    article_data.update({
                        "enhancedTitle": article_data.get("title", ""),
                        "articleContent": article_data.get("content", ""),
                        "summary": article_data.get("content", "")[:100] + "..." if article_data.get("content") else ""
                    })
                
                # Log for debugging
                print(f"Processed article: {article_data['title']}")
                
            except Exception as e:
                logger.error(f"Error enhancing article: {str(e)}")
                # Continue with the original data if enhancement fails
            
            processed_articles.append(article_data)
            
        # Prepare the data for Express server
        return {
            "sourceApi": "NewsAPI",
            "articles": processed_articles
        }
        
    except Exception as e:
        logger.error(f"Error fetching or processing news: {str(e)}")
        return {"error": f"Error fetching or processing news: {str(e)}"}

def send_to_express(processed_data):
    """
    Send the processed articles to Express server
    
    Args:
        processed_data: Processed articles data
        
    Returns:
        Response from Express server
    """
    if "error" in processed_data:
        return {"error": processed_data["error"]}, 500
    
    # We need to send to Express for AI processing and storage first, 
    # then return the formatted data for frontend display
    
    # First, send to Express server for storage
    try:
        # Debug information
        print(f"Sending {len(processed_data.get('articles', []))} articles to Express server at {EXPRESS_SERVER_URL}")
        
        # Send the processed data to Express server for AI processing and storage
        response = requests.post(
            EXPRESS_SERVER_URL, 
            json=processed_data,
            headers={"Content-Type": "application/json"},
            timeout=60  # Increased timeout for AI processing (doubled)
        )
        
        print(f"Express server response: {response.status_code}")
        
        if response.status_code != 201:
            print(f"Error response text: {response.text}")
            logger.error(f"Error sending to Express: {response.text}")
            
            # If Express storage fails, we still want to return data for display
            # but we should log the error
            logger.error("Failed to store articles in database, returning direct data instead")
            
            # Format data for frontend as a fallback
            articles_formatted = []
            for article in processed_data.get("articles", []):
                formatted_article = {
                    "id": hash(article.get("title", "") + article.get("sourceUrl", "")),
                    "title": article.get("enhancedTitle", article.get("title", "")),
                    "content": article.get("articleContent", article.get("content", "")),
                    "summary": article.get("summary", ""),
                    "sourceUrl": article.get("sourceUrl", ""),
                    "sourceName": article.get("source", "News API"),
                    "published": article.get("publishedAt", ""),
                    "authorName": article.get("author", ""),
                    "country": article.get("country", "US"),
                    "category": article.get("category", "General"),
                    "imageUrl": article.get("imageUrl", ""),
                    "isAiGenerated": True,
                    "rawOriginal": article.get("rawData", "{}"),
                    "createdAt": article.get("publishedAt", "")
                }
                articles_formatted.append(formatted_article)
            
            print(f"Returning {len(articles_formatted)} articles directly to frontend (Express storage failed)")
            return {"articles": articles_formatted, "message": "Articles processed but not stored"}, 200
        
        # If storage was successful, return the data from Express which now includes database IDs
        return response.json(), response.status_code
        
    except requests.exceptions.Timeout:
        error_msg = f"Request to Express server timed out after 60 seconds"
        print(error_msg)
        logger.error(error_msg)
        
        # Format data for frontend as a fallback
        articles_formatted = []
        for article in processed_data.get("articles", []):
            formatted_article = {
                "id": hash(article.get("title", "") + article.get("sourceUrl", "")),
                "title": article.get("enhancedTitle", article.get("title", "")),
                "content": article.get("articleContent", article.get("content", "")),
                "summary": article.get("summary", ""),
                "sourceUrl": article.get("sourceUrl", ""),
                "sourceName": article.get("source", "News API"),
                "published": article.get("publishedAt", ""),
                "authorName": article.get("author", ""),
                "country": article.get("country", "US"),
                "category": article.get("category", "General"),
                "imageUrl": article.get("imageUrl", ""),
                "isAiGenerated": True,
                "rawOriginal": article.get("rawData", "{}"),
                "createdAt": article.get("publishedAt", "")
            }
            articles_formatted.append(formatted_article)
        
        print(f"Returning {len(articles_formatted)} articles directly to frontend (Express timeout)")
        return {"articles": articles_formatted, "message": "Articles processed but not stored (timeout)"}, 200
        
    except Exception as e:
        import traceback
        print(f"Error in Express communication: {str(e)}")
        print(traceback.format_exc())
        logger.error(f"Error in Express communication: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Format data for frontend as a fallback
        articles_formatted = []
        for article in processed_data.get("articles", []):
            formatted_article = {
                "id": hash(article.get("title", "") + article.get("sourceUrl", "")),
                "title": article.get("enhancedTitle", article.get("title", "")),
                "content": article.get("articleContent", article.get("content", "")),
                "summary": article.get("summary", ""),
                "sourceUrl": article.get("sourceUrl", ""),
                "sourceName": article.get("source", "News API"),
                "published": article.get("publishedAt", ""),
                "authorName": article.get("author", ""),
                "country": article.get("country", "US"),
                "category": article.get("category", "General"),
                "imageUrl": article.get("imageUrl", ""),
                "isAiGenerated": True,
                "rawOriginal": article.get("rawData", "{}"),
                "createdAt": article.get("publishedAt", "")
            }
            articles_formatted.append(formatted_article)
        
        print(f"Returning {len(articles_formatted)} articles directly to frontend (Express error)")
        return {"articles": articles_formatted, "message": "Articles processed but not stored (error)"}, 200