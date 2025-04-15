import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateArticleSummary(text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Generate a concise news article summary in 2-3 sentences."
      },
      {
        role: "user",
        content: text
      }
    ],
  });

  return response.choices[0].message.content || "";
}

export async function generateArticleContent(data: {
  title: string;
  content: string;
  category: string;
  country: string;
}): Promise<{
  enhancedTitle: string;
  articleContent: string;
  summary: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert news journalist. Write a complete, engaging news article based on the provided information. Follow these guidelines:
1. Create an attention-grabbing headline
2. Write in a professional journalistic style
3. Include relevant context and background
4. Maintain factual accuracy
5. End with a strong conclusion

Format your response as JSON with three fields:
- enhancedTitle: A compelling headline
- articleContent: The full article text
- summary: A 2-3 sentence summary of the key points`
      },
      {
        role: "user",
        content: `Raw News Data:
Title: ${data.title}
Content: ${data.content}
Category: ${data.category}
Country: ${data.country}`
      }
    ],
    response_format: { type: "json_object" }
  });

  return JSON.parse(response.choices[0].message.content || "{}");
}

export async function generateArticleChat(message: string, context: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a helpful news assistant that helps users understand news articles better. Use the provided article context to answer questions, create explainers, and provide insights. Keep responses informative but concise. Only answer questions related to the provided article context. If a question is not related to the article, politely redirect the user to ask about the article's content."
      },
      {
        role: "user",
        content: `Article context: ${context}\n\nUser question: ${message}`
      }
    ],
  });

  return response.choices[0].message.content || "";
}

export async function generateArticleVariants(article: {
  title: string;
  content: string;
}): Promise<{
  socialPost: string;
  shortForm: string;
  newsChannel: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Generate three variants of the article in different formats. Provide JSON with: socialPost (280 chars), shortForm (500 chars), and newsChannel (broadcast script)"
      },
      {
        role: "user",
        content: `Title: ${article.title}\n\nContent: ${article.content}`
      }
    ],
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    socialPost: result.socialPost,
    shortForm: result.shortForm,
    newsChannel: result.newsChannel
  };
}

/**
 * Analyzes article sentiment, objectivity, and key themes
 * 
 * @param content - The article content to analyze
 * @returns Object with sentiment analysis data
 */
export async function analyzeArticle(content: string): Promise<{
  sentiment: string;
  objectivity: number;
  keyThemes: string[];
  potentialBias: string;
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Analyze the following news article text for sentiment, objectivity, and key themes.
Provide your analysis in JSON format with these fields:
- sentiment: "positive", "negative", or "neutral"
- objectivity: Rating from 1-10 where 10 is completely objective
- keyThemes: Array of 3-5 key themes or topics
- potentialBias: Description of any detected bias or "None detected" if none found`
      },
      {
        role: "user",
        content: content
      }
    ],
    response_format: { type: "json_object" }
  });

  const result = JSON.parse(response.choices[0].message.content || "{}");
  return {
    sentiment: result.sentiment || "neutral",
    objectivity: result.objectivity || 5,
    keyThemes: result.keyThemes || [],
    potentialBias: result.potentialBias || "Analysis not available"
  };
}