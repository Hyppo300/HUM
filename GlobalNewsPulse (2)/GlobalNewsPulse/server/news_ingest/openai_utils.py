"""
OpenAI Utilities for News Ingestion

This module contains functions for processing news data with OpenAI.
It's designed to be used by the Flask server that receives news data 
from the News API and processes it before forwarding to the Express server.
"""

import os
import json
from typing import Dict, Any, Optional
import openai

# Initialize the OpenAI client
client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def validate_api_key() -> bool:
    """Check if the OpenAI API key is configured."""
    return os.environ.get("OPENAI_API_KEY") is not None

def enhance_article(article_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhances a raw news article using OpenAI.
    
    Args:
        article_data: Raw article data from news API
        
    Returns:
        Dictionary with enhanced article content
    """
    if not validate_api_key():
        raise ValueError("OpenAI API key not configured")
        
    # Extract data from the article
    title = article_data.get("title", "")
    content = article_data.get("content", "")
    description = article_data.get("description", "")
    source = article_data.get("source", "")
    category = article_data.get("category", "General")
    country = article_data.get("country", "US")
    
    # Create the context for GPT
    prompt = f"""
You are an experienced journalist tasked with expanding a news article from limited information.

Original Title: {title}
Source: {source}
Category: {category}
Country: {country}
Raw Content: {content if content else description}

Please generate an expanded, well-structured news article based on this information.
Your article should be:
1. Factual and based strictly on the provided information
2. Written in journalistic style with an objective tone
3. 3-5 paragraphs long
4. Include quotes only if they were in the original content

Also provide:
1. An improved headline that captures attention while being factual
2. A concise 1-2 sentence summary of the article

Return your response in the following JSON format:
{{
  "enhancedTitle": "Improved headline",
  "articleContent": "Full expanded article content...",
  "summary": "Brief 1-2 sentence summary"
}}
"""

    try:
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a professional journalist and news editor."},
                {"role": "user", "content": prompt}
            ]
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
        
    except Exception as e:
        print(f"Error enhancing article: {str(e)}")
        # Return original data if enhancement fails
        return {
            "enhancedTitle": title,
            "articleContent": content or description,
            "summary": description or content[:100] + "..."
        }

def generate_article_variants(title: str, content: str) -> Dict[str, str]:
    """
    Creates alternative formats of an article for different platforms.
    
    Args:
        title: Article title
        content: Article content
        
    Returns:
        Dictionary with social post, short-form and broadcast versions
    """
    if not validate_api_key():
        raise ValueError("OpenAI API key not configured")
        
    prompt = f"""
Generate three alternative versions of this news article for different platforms:

Title: {title}

Content: {content}

Please create:
1. A social media post (180 characters max)
2. A short-form summary (3-4 bullet points)
3. A broadcast script for a news anchor (30 seconds)

Return your response in JSON format:
{{
  "socialPost": "...",
  "shortForm": "...",
  "newsChannel": "..."
}}
"""

    try:
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a content marketing specialist."},
                {"role": "user", "content": prompt}
            ]
        )
        
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        print(f"Error generating article variants: {str(e)}")
        return {
            "socialPost": f"{title}",
            "shortForm": f"• {title}",
            "newsChannel": f"Today we're reporting on {title}."
        }

def analyze_sentiment(text: str) -> Dict[str, Any]:
    """
    Analyzes the sentiment and content of an article.
    
    Args:
        text: Article text to analyze
        
    Returns:
        Dictionary with sentiment analysis
    """
    if not validate_api_key():
        raise ValueError("OpenAI API key not configured")
        
    prompt = f"""
Analyze the following news article text for sentiment, objectivity, and key themes:

{text}

Provide your analysis in JSON format:
{{
  "sentiment": "positive/negative/neutral",
  "objectivity": "scale 1-10 where 10 is completely objective",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "potentialBias": "description of any detected bias or none if none detected"
}}
"""

    try:
        # the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You are a media analysis expert."},
                {"role": "user", "content": prompt}
            ]
        )
        
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        print(f"Error analyzing sentiment: {str(e)}")
        return {
            "sentiment": "neutral",
            "objectivity": 5,
            "keyThemes": [],
            "potentialBias": "Analysis failed"
        }