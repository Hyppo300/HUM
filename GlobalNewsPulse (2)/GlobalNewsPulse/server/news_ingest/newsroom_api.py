"""
Newsroom API Integration for News Aggregation Platform

This module handles the interaction with the Newsroom API from hum.tv.
It retrieves the latest news articles published in the last 4 hours.

API Details:
- Base URL: https://newsroom.hum.tv/api/v1/
- Authentication: API key in header
- Method: POST only
- Rate Limit: 1 request per 60 seconds per IP address
"""

import os
import requests
import time
import logging
from datetime import datetime
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Constants
NEWSROOM_API_URL = "https://newsroom.hum.tv/api/v1/"
NEWSROOM_API_KEY = "H3NjZv5ZQ6kIXSzbFWJS6haHgbphpSmo"
RATE_LIMIT_SECONDS = 60  # 1 request per 60 seconds

# Store the last request timestamp to respect rate limiting
last_request_time = 0

def fetch_newsroom_articles():
    """
    Fetch news articles from the Newsroom API.
    
    Returns:
        dict: A dictionary with news articles formatted for our platform.
    """
    global last_request_time
    
    # Check rate limiting
    current_time = time.time()
    time_since_last_request = current_time - last_request_time
    
    if time_since_last_request < RATE_LIMIT_SECONDS:
        wait_time = RATE_LIMIT_SECONDS - time_since_last_request
        logger.info(f"Rate limit in effect. Waiting {wait_time:.2f} seconds before making request...")
        time.sleep(wait_time)
    
    # Set headers with API key
    headers = {
        "api-key": NEWSROOM_API_KEY,
        "Content-Type": "application/json"
    }
    
    try:
        # Make the POST request to Newsroom API
        logger.info(f"Making request to Newsroom API: {NEWSROOM_API_URL}")
        # Set a reasonable timeout for the request
        response = requests.post(NEWSROOM_API_URL, headers=headers, timeout=30)
        
        # Update last request time
        last_request_time = time.time()
        
        # Check for errors
        if response.status_code == 403:
            logger.error("API key is invalid or missing")
            return {"error": "Invalid API key"}
        elif response.status_code == 405:
            logger.error("Method not allowed (only POST is supported)")
            return {"error": "Method not allowed"}
        elif response.status_code == 429:
            logger.error("Rate limit exceeded")
            return {"error": "Rate limit exceeded"}
        elif response.status_code == 500:
            logger.error("Server error from Newsroom API")
            return {"error": "Server error from Newsroom API"}
        elif response.status_code != 200:
            logger.error(f"Unexpected status code: {response.status_code}")
            return {"error": f"Unexpected status code: {response.status_code}"}
        
        # Parse response carefully to handle both JSON and string responses
        try:
            # Try to parse as JSON
            news_data = response.json()
            
            # Check if the response is already an error message
            if isinstance(news_data, dict) and "error" in news_data:
                logger.error(f"API returned error: {news_data['error']}")
                return {"error": news_data["error"]}
                
            # Check if news_data is a string (sometimes APIs return JSON-formatted strings)
            if isinstance(news_data, str):
                try:
                    news_data = json.loads(news_data)
                except json.JSONDecodeError:
                    logger.error("Response is a string but not valid JSON")
                    return {"error": "Invalid response format from API", "articles": []}
            
            # Check if news_data is iterable (list or array)
            if not isinstance(news_data, list):
                # If it's not a list, check if it has an 'articles' property
                if isinstance(news_data, dict) and "articles" in news_data:
                    news_data = news_data["articles"]
                elif isinstance(news_data, dict) and "data" in news_data and isinstance(news_data["data"], list):
                    # Some APIs nest data under a "data" key
                    news_data = news_data["data"]
                else:
                    logger.error(f"Unexpected response format: {type(news_data)}")
                    logger.info(f"Response content: {str(news_data)[:500]}")  # Log a sample of the content
                    return {"error": "Unexpected response format", "articles": []}
            
            # Transform the data to match our application's format
            transformed_data = {
                "sourceApi": "Newsroom API",
                "articles": []
            }
            
            if len(news_data) == 0:
                logger.info("No articles returned from Newsroom API")
                return transformed_data
            
            for article in news_data:
                if not isinstance(article, dict):
                    logger.warning(f"Skipping non-dict article: {article}")
                    continue
                    
                # Create standardized article format
                formatted_article = {
                    "title": article.get("title", "Untitled Article"),
                    "description": article.get("description", ""),
                    "content": article.get("content", article.get("description", "")),
                    "url": article.get("url", ""),
                    "urlToImage": article.get("image_url", ""),
                    "publishedAt": article.get("published_at", datetime.now().isoformat()),
                    "source": {
                        "name": article.get("source", "Newsroom")
                    },
                    "author": article.get("author", "Newsroom Staff"),
                    "category": article.get("category", "general"),
                    "country": article.get("country", "GLOBAL"),  # Global news by default from Newsroom
                    "originalJson": json.dumps(article)
                }
                
                transformed_data["articles"].append(formatted_article)
                
        except json.JSONDecodeError:
            # If JSON parsing failed, try to work with the raw response text
            logger.error("Failed to parse response as JSON, trying to handle raw text")
            raw_content = response.text
            
            # Debug the raw response
            logger.info(f"Raw response content: {raw_content[:200]}...")
            
            # Return a meaningful error but with an empty articles list to avoid breaking the app
            return {"error": "Invalid JSON response from Newsroom API", "articles": []}
        
        logger.info(f"Successfully fetched {len(transformed_data['articles'])} articles from Newsroom API")
        return transformed_data
        
    except Exception as e:
        logger.error(f"Error fetching from Newsroom API: {str(e)}")
        return {"error": f"Failed to fetch from Newsroom API: {str(e)}"}

# Function to manually test the API
if __name__ == "__main__":
    result = fetch_newsroom_articles()
    if isinstance(result, dict) and "error" in result:
        print(f"Error: {result.get('error')}")
    elif isinstance(result, dict) and "articles" in result:
        articles = result.get("articles", [])
        print(f"Successfully fetched {len(articles)} articles")
        for idx, article in enumerate(articles):
            if isinstance(article, dict):
                print(f"\nArticle {idx+1}:")
                print(f"Title: {article.get('title', 'Unknown title')}")
                
                source = article.get('source', {})
                if isinstance(source, dict):
                    source_name = source.get('name', 'Unknown source')
                else:
                    source_name = str(source)
                print(f"Source: {source_name}")
                
                print(f"Published: {article.get('publishedAt', 'Unknown date')}")
            else:
                print(f"\nArticle {idx+1}: Invalid format - {type(article)}")
    else:
        print(f"Unexpected response format: {type(result)}")
        if hasattr(result, "__str__"):
            print(f"Response content: {str(result)[:200]}...")