# AI Components for News Platform

This document explains the AI-powered components of our news platform and how they work together to provide an enhanced news experience.

## Overview

Our platform uses OpenAI's GPT models to transform raw news data into rich, enhanced content. The system works in three main stages:

1. **News Collection**: PHP server fetches data from various news APIs
2. **AI Enhancement**: Flask server processes and enhances the content using OpenAI
3. **Display & Interaction**: Frontend displays the enhanced content and provides an interactive AI chat feature

## Key Files

### 1. AI Integration Core Files

- **`server/openai-new.ts`** - Main TypeScript module with all OpenAI functions for the Express backend
- **`server/news_ingest/openai_utils.py`** - Python utilities for the Flask server
- **`server/news_ingest/example_php_client.php`** - Example PHP code for the news fetching service

### 2. Frontend Components

- **`client/src/components/ArticleViewer.tsx`** - React component with chat interface
- **`client/src/pages/article-page.tsx`** - Article page with placeholder for testing

## How It Works

### News Data Flow

```
News APIs → PHP Server → Flask Server → Express Server → Frontend
```

1. PHP server fetches articles from news APIs (using News API key: `06c62363bc8e42ba81c37c9c6910d9e3`)
2. PHP sends raw JSON data to Flask server with JWT authentication
3. Flask processes and enhances the content using OpenAI
4. Flask forwards the enhanced content to Express
5. Express stores the content and serves it to the frontend

### AI Features

1. **Article Enhancement**
   - Transforms raw JSON data into complete, well-written articles
   - Generates improved headlines and summaries
   - Analyzes sentiment and categorizes content

2. **Interactive Chat**
   - Answers questions about the specific article
   - Provides explanations of complex concepts
   - Fact-checks claims made in the article
   - Summarizes key points

3. **Content Variants**
   - Creates social media posts
   - Generates short-form versions
   - Produces broadcast scripts for different formats

## For the Frontend Developer

The frontend needs to:

1. Display the AI-enhanced content in the article viewer
2. Implement the chat feature that sends user questions to the `/api/chat` endpoint
3. Show summary and other AI-generated metadata
4. Handle the article variants for sharing/distribution

All OpenAI calls are handled by the backend - the frontend simply needs to display the results and send user input to the appropriate endpoints.

## For the PHP Developer

The PHP server needs to:

1. Fetch data from news APIs using the provided API key
2. Format the data according to the expected schema
3. Authenticate with the Flask server using JWT
4. Send the data in batches to avoid overloading the processing pipeline
5. Implement error handling and retries

## Environment Variables

The following environment variables are required:

- `OPENAI_API_KEY` - For accessing OpenAI's API
- `JWT_SECRET_KEY` - Shared secret for JWT authentication between PHP and Flask
- `NEWS_INGESTION_API_KEY` - For the Flask server to authenticate requests

## API Endpoints

1. **Flask Server**
   - POST `/receive_news` - Receives news data from PHP server

2. **Express Server**
   - POST `/api/news/batch` - Receives processed news from Flask
   - GET `/api/articles` - Lists articles (optional country filter)
   - GET `/api/articles/:id` - Gets a specific article
   - POST `/api/chat` - Processes chat messages about articles

## Getting Started

1. Make sure all environment variables are set
2. Start the Express server with `npm run dev`
3. Start the Flask server with `python3 server/news_ingest/app.py`
4. The PHP script can be run manually or scheduled via cron