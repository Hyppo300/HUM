from flask import Flask, request, jsonify
from flask_jwt_extended import JWTManager, jwt_required, create_access_token
from flask_cors import CORS
import os
import requests
import threading
import time
from datetime import timedelta
import json
from fetch_news import fetch_news_articles, send_to_express
from newsroom_api import fetch_newsroom_articles

app = Flask(__name__)
# Enable CORS for all routes to allow frontend communication
CORS(app)

# Setup the Flask-JWT-Extended extension
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "your-secret-key")  # Change this!
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
jwt = JWTManager(app)

# Queue for articles pending background processing
pending_newsroom_articles = []
processing_lock = threading.Lock()
is_processing = False

# Background processing thread function
def process_pending_articles():
    global pending_newsroom_articles, is_processing
    
    with processing_lock:
        if is_processing:
            app.logger.info("Background processing already running, skipping")
            return
        is_processing = True
    
    app.logger.info(f"Starting background processing of {len(pending_newsroom_articles)} pending articles")
    
    # Define the batch size for processing multiple articles at once
    # Using a smaller batch size to prevent timeouts
    BATCH_SIZE = 5
    
    try:
        while len(pending_newsroom_articles) > 0:
            with processing_lock:
                # Take a batch of articles from the queue
                if len(pending_newsroom_articles) == 0:
                    break
                
                # Get up to BATCH_SIZE articles (or fewer if that's all that's left)
                batch_size = min(BATCH_SIZE, len(pending_newsroom_articles))
                batch_articles = pending_newsroom_articles[:batch_size]
                # Remove the articles we're about to process from the queue
                pending_newsroom_articles = pending_newsroom_articles[batch_size:]
                remaining = len(pending_newsroom_articles)
            
            # Process this batch of articles
            app.logger.info(f"Processing {batch_size} articles from queue, {remaining} remaining")
            
            try:
                # Create the payload with the batch of articles
                processed_data = {
                    "sourceApi": "NewsroomAPI",
                    "articles": batch_articles
                }
                
                # Send to Express for processing and storage
                response_data, status_code = send_to_express(processed_data)
                
                # Check if it was successful
                if status_code == 201:
                    app.logger.info(f"Successfully stored {batch_size} queued articles in database, {remaining} remaining")
                else:
                    app.logger.warning(f"Failed to store queued articles in database, status code: {status_code}")
                
                # Add a very small delay to prevent completely overwhelming the Express server
                # This is much faster than the previous 60-second delay and allows the server to breathe
                time.sleep(0.5)
                
            except Exception as e:
                app.logger.error(f"Error processing queued articles: {str(e)}")
                # Continue with the next batch with a shorter delay on error
                time.sleep(1)
    
    except Exception as e:
        app.logger.error(f"Error in background processing thread: {str(e)}")
    
    finally:
        with processing_lock:
            is_processing = False
        app.logger.info("Background processing completed or stopped")

@app.route("/auth", methods=["POST"])
def auth():
    """Authenticate the PHP server and return a JWT token"""
    if not request.is_json:
        return jsonify({"error": "Missing JSON in request"}), 400

    api_key = request.json.get("api_key", None)
    if not api_key:
        return jsonify({"error": "Missing API key"}), 400

    # Verify the API key (you should store this securely)
    if api_key != os.environ.get("NEWS_INGESTION_API_KEY"):
        return jsonify({"error": "Invalid API key"}), 401

    # Create the access token
    access_token = create_access_token(identity="php_server")
    return jsonify(access_token=access_token)

@app.route("/news/batch", methods=["POST"])
@jwt_required()
def receive_news():
    """Receive news data from PHP server and forward to Express server"""
    if not request.is_json:
        return jsonify({"error": "Missing JSON in request"}), 400

    try:
        news_data = request.json
        processed_data = {
            "sourceApi": news_data.get("sourceApi", "unknown"),
            "articles": []
        }

        for article in news_data.get("articles", []):
            # Store the original article data as JSON string
            article["originalJson"] = json.dumps(article)
            processed_data["articles"].append(article)

        # Forward the processed data to Express server
        express_url = f"http://localhost:5000/api/news/batch"
        response = requests.post(express_url, json=processed_data)

        if response.status_code != 201:
            return jsonify({"error": "Failed to process articles"}), 500

        return jsonify(response.json()), response.status_code

    except Exception as e:
        app.logger.error(f"Error processing news data: {str(e)}")
        return jsonify({"error": f"Failed to process news data: {str(e)}"}), 500

@app.route("/fetch-news", methods=["GET"])
def fetch_news():
    """
    Fetch news from News API and process it
    
    Query parameters:
    - country: Country code (default: us)
    - category: Category (business, entertainment, general, health, science, sports, technology)
    - page_size: Number of articles to fetch (default: 20)
    - query: Search query term (if provided, uses /everything endpoint instead of /top-headlines)
    - trending: If 'true', fetches trending/hot news. If country is specified, shows trending news for that country.
                Otherwise, shows global trending news.
    """
    # Add CORS headers to allow cross-origin requests (especially important for development)
    # This ensures our frontend can communicate with this endpoint
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    try:
        # Get query parameters
        country = request.args.get("country", "us")
        category = request.args.get("category")
        page_size = int(request.args.get("page_size", "20"))
        query = request.args.get("query")
        trending = request.args.get("trending", "").lower() == "true"
        
        print(f"DEBUG: Fetching news with params: country={country}, category={category}, trending={trending}, query={query}")
        app.logger.info(f"Fetching news with params: country={country}, category={category}, trending={trending}, query={query}")
        
        # Check if we have a valid API key
        if not os.environ.get("NEWS_API_KEY"):
            app.logger.error("NEWS_API_KEY environment variable is not set")
            return jsonify({"error": "NEWS_API_KEY not set. Please provide a valid News API key."}), 500
            
        # Fetch news articles with optional search query or trending mode
        news_data = fetch_news_articles(country, category, page_size, query, trending)
        
        if "error" in news_data:
            error_msg = news_data["error"]
            app.logger.error(f"Error from fetch_news_articles: {error_msg}")
            return jsonify({"error": error_msg}), 500
        
        # Send to Express for AI processing and database storage
        try:
            # Send to Express server for AI enhancement and database storage
            app.logger.info(f"Successfully fetched {len(news_data.get('articles', []))} articles, sending to Express for processing")
            response, status_code = send_to_express(news_data)
            
            # Check if storage was successful
            if status_code == 201:
                app.logger.info(f"Successfully stored {len(news_data.get('articles', []))} articles in database")
            else:
                app.logger.warning(f"Articles may not have been stored in database, status code: {status_code}")
                
            return jsonify(response), status_code
            
        except Exception as e:
            app.logger.error(f"Error processing news data for database storage: {str(e)}")
            # If direct handling fails, try the Express route (fallback)
            app.logger.info(f"Falling back to Express server...")
            
            try:
                response, status_code = send_to_express(news_data)
                return jsonify(response), status_code
            except Exception as e2:
                app.logger.error(f"Express fallback also failed: {str(e2)}")
                
                # Format the data for frontend as a last resort
                articles_formatted = []
                for article in news_data.get("articles", []):
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
                
                print(f"Returning {len(articles_formatted)} articles directly to frontend (all Express attempts failed)")
                return jsonify({"articles": articles_formatted, "message": "Articles processed but not stored (error)"}), 200
    
    except Exception as e:
        import traceback
        app.logger.error(f"Error fetching news: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({"error": f"Failed to fetch news: {str(e)}"}), 500

@app.route("/fetch-newsroom", methods=["GET"])
def fetch_newsroom():
    """
    Fetch news from the Newsroom API
    
    This endpoint retrieves the latest news articles from the Newsroom API (hum.tv)
    that were published in the last 4 hours. No parameters are needed since the API
    automatically returns the latest articles.
    """
    # Add CORS headers to allow cross-origin requests (especially important for development)
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)
    
    try:
        app.logger.info("Fetching news from Newsroom API")
        
        # Fetch news articles from Newsroom API
        news_data = fetch_newsroom_articles()
        
        # Ensure news_data has proper structure even if there was an error
        if isinstance(news_data, dict):
            if "error" in news_data:
                error_msg = news_data["error"]
                app.logger.error(f"Error from fetch_newsroom_articles: {error_msg}")
                
                # Make sure to return a valid articles array even on error to avoid breaking the frontend
                if "articles" not in news_data:
                    news_data["articles"] = []
                
                # Return 200 instead of 500 to allow the frontend to handle gracefully
                return jsonify(news_data), 200
            
            # Ensure articles key exists
            if "articles" not in news_data:
                news_data["articles"] = []
        else:
            # If news_data is not a dict, create a valid response structure
            app.logger.error(f"Unexpected response type from fetch_newsroom_articles: {type(news_data)}")
            news_data = {
                "error": "Invalid response format from Newsroom API",
                "articles": []
            }
            
        # Process one article at a time to avoid "request entity too large" errors
        try:
            # Get the articles from the response
            articles = news_data.get("articles", [])
            article_count = len(articles)
            app.logger.info(f"Successfully fetched {article_count} articles from Newsroom, processing 1 article for storage")
            
            # Only process 1 article to avoid overloading the server
            # The rest will be processed via the background task (one per minute)
            if article_count > 0:
                # Take the first article
                first_article = articles[0]
                
                # Create a payload with just this one article
                processed_data = {
                    "sourceApi": "NewsroomAPI",
                    "articles": [first_article]
                }
                
                # Send just one article to Express for storage
                response_data, status_code = send_to_express(processed_data)
                
                # Check if storage was successful
                if status_code == 201:
                    app.logger.info(f"Successfully stored 1 article in database from Newsroom, {article_count-1} more will be processed in the background")
                else:
                    app.logger.warning(f"Article may not have been stored in database, status code: {status_code}")
                
                # Store the remaining articles for background processing
                if article_count > 1:
                    # Create a global variable to store the remaining articles for background processing
                    global pending_newsroom_articles
                    pending_newsroom_articles = articles[1:]
                    article_count_remaining = len(pending_newsroom_articles)
                    app.logger.info(f"Queued {article_count_remaining} articles for background processing")
                    
                    # Start the background processing thread
                    thread = threading.Thread(target=process_pending_articles)
                    thread.daemon = True  # Thread will exit when main thread exits
                    thread.start()
                    app.logger.info(f"Started background processing thread for {article_count_remaining} articles")
            
            # Return the full set of articles for display
            return jsonify(news_data), 200
            
        except Exception as e:
            app.logger.error(f"Error storing Newsroom data in database: {str(e)}")
            # If database storage fails, still return the data directly
            article_count = len(news_data.get("articles", []))
            app.logger.info(f"Successfully fetched {article_count} articles from Newsroom, returning directly (storage failed)")
            return jsonify(news_data), 200
    
    except Exception as e:
        import traceback
        app.logger.error(f"Error fetching from Newsroom API: {str(e)}")
        app.logger.error(traceback.format_exc())
        # Return a valid but empty response to avoid breaking the frontend
        return jsonify({
            "error": f"Failed to fetch from Newsroom API: {str(e)}",
            "articles": []
        }), 200  # Use 200 instead of 500 to allow frontend to handle gracefully

@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health_check():
    """
    Simple health check endpoint to verify Flask server is running.
    Used by Express server for connection testing.
    """
    return jsonify({
        "status": "ok",
        "message": "Flask server is running",
        "version": "1.0.0",
        "services": {
            "newsroom_api": True,
            "news_api": True
        }
    }), 200

@app.route("/newsroom-test", methods=["GET"])
def newsroom_test():
    """
    Test endpoint for Newsroom API to check if it's functioning correctly,
    without going through the full fetch-newsroom endpoint.
    """
    try:
        # Import and call fetch_newsroom_articles, but with validation
        from newsroom_api import fetch_newsroom_articles
        
        # Call the function and get the result
        app.logger.info("Testing Newsroom API...")
        result = fetch_newsroom_articles()
        
        # Check if the result is valid
        if isinstance(result, dict):
            if "error" in result:
                app.logger.error(f"Error from Newsroom API test: {result['error']}")
                return jsonify({
                    "status": "error",
                    "message": f"Newsroom API test failed: {result['error']}",
                    "articles": []
                }), 200
            
            # Check if articles exist and is a list
            if "articles" in result and isinstance(result["articles"], list):
                article_count = len(result["articles"])
                app.logger.info(f"Newsroom API test successful, found {article_count} articles")
                
                # Return success with limited info to keep response small
                return jsonify({
                    "status": "ok",
                    "message": f"Newsroom API test successful, found {article_count} articles",
                    "article_count": article_count,
                    "sample": result["articles"][0] if article_count > 0 else None
                }), 200
            else:
                app.logger.error("Newsroom API test returned invalid format (missing articles array)")
                return jsonify({
                    "status": "error",
                    "message": "Newsroom API test returned invalid format (missing articles array)",
                    "articles": []
                }), 200
        else:
            app.logger.error(f"Newsroom API test returned invalid type: {type(result)}")
            return jsonify({
                "status": "error",
                "message": f"Newsroom API test returned invalid type: {type(result)}",
                "articles": []
            }), 200
    
    except Exception as e:
        import traceback
        app.logger.error(f"Exception in Newsroom API test: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            "status": "error",
            "message": f"Newsroom API test failed with exception: {str(e)}",
            "articles": []
        }), 200

@app.route("/process-queue", methods=["GET"])
def start_processing_queue():
    """
    Start processing the queued articles in the background
    This is useful for manual triggering of the background process
    """
    # Check if there are any pending articles
    if len(pending_newsroom_articles) == 0:
        return jsonify({
            "status": "ok",
            "message": "No articles in queue to process"
        }), 200
    
    # Start the background processing thread
    thread = threading.Thread(target=process_pending_articles)
    thread.daemon = True  # Thread will exit when main thread exits
    thread.start()
    
    return jsonify({
        "status": "ok",
        "message": f"Started processing {len(pending_newsroom_articles)} queued articles in the background"
    }), 200

if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5001))
    
    # Start the Flask app with threading enabled
    app.run(host="0.0.0.0", port=port, threaded=True)