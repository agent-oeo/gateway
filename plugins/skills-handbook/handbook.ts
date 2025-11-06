import {
  HookEventType,
  PluginContext,
  PluginHandler,
  PluginParameters,
} from '../types';
import { getCurrentContentPart, post } from '../utils';

interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: Record<string, any>;
}

interface QdrantSearchResponse {
  result: QdrantSearchResult[];
}

/**
 * Get embedding vector from OpenAI API
 * @param text - Text to embed
 * @param openaiApiKey - OpenAI API key
 * @param model - OpenAI embedding model (default: text-embedding-3-small)
 * @returns Embedding vector
 */
const getOpenAIEmbedding = async (
  text: string,
  openaiApiKey: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> => {
  const embeddingURL = 'https://api.openai.com/v1/embeddings';

  const requestBody = {
    input: text,
    model: model,
  };

  const options = {
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
  };

  const result = await post(embeddingURL, requestBody, options, 30000);
  return result.data[0].embedding;
};

/**
 * Performs a search query against a Qdrant collection
 * @param query - The text query to search for
 * @param collectionName - The name of the Qdrant collection
 * @param qdrantEndpoint - The Qdrant instance endpoint URL
 * @param qdrantApiKey - The Qdrant API key
 * @param openaiApiKey - OpenAI API key for embeddings
 * @param topK - Number of results to retrieve
 * @param scoreThreshold - Minimum similarity score threshold
 * @param timeout - Request timeout in milliseconds
 * @returns Search results or null if no results found
 */
const queryQdrant = async (
  query: string,
  collectionName: string,
  qdrantEndpoint: string,
  qdrantApiKey: string,
  openaiApiKey: string,
  topK: number = 3,
  scoreThreshold: number = 0.7,
  timeout: number = 10000
): Promise<{ results: any[] | null; data: any }> => {
  if (!query.trim() || !collectionName) {
    return { results: null, data: null };
  }

  // Remove trailing slash from endpoint if present
  const baseURL = qdrantEndpoint.replace(/\/$/, '');
  const searchURL = `${baseURL}/collections/${collectionName}/points/search`;

  // Get embedding from OpenAI
  const queryVector = await getOpenAIEmbedding(query, openaiApiKey);

  const searchBody = {
    vector: queryVector,
    limit: topK,
    score_threshold: scoreThreshold,
    with_payload: true,
  };

  const options = {
    headers: {
      'api-key': qdrantApiKey,
      'Content-Type': 'application/json',
    },
  };

  try {
    const result: QdrantSearchResponse = await post(
      searchURL,
      searchBody,
      options,
      timeout
    );

    if (!result.result || result.result.length === 0) {
      return { results: null, data: null };
    }

    const formattedResults = result.result.map((item) => ({
      id: item.id,
      score: item.score,
      content: item.payload,
    }));

    return { results: formattedResults, data: result };
  } catch (error) {
    console.error(`Error querying Qdrant collection ${collectionName}:`, error);
    return { results: null, data: { error } };
  }
};

/**
 * Formats memory results into a readable string for prompt insertion
 * @param results - Array of memory results from Qdrant
 * @param prefix - String to prepend to the formatted section
 * @param suffix - String to append to the formatted section
 * @returns Formatted string containing the memories
 */
const formatMemoriesForPrompt = (
  results: any[],
  prefix: string,
  suffix: string
): string => {
  if (!results || results.length === 0) return '';

  let formattedText = prefix;

  results.forEach((result, index) => {
    const content = result.content;

    // Format the memory content
    if (typeof content === 'string') {
      formattedText += `${index + 1}. ${content}\n`;
    } else if (typeof content === 'object') {
      // If the payload has specific fields like 'example', 'description', 'tool', etc.
      formattedText += `${index + 1}. `;

      if (content.tool) {
        formattedText += `[Tool: ${content.tool}] `;
      }

      if (content.example) {
        formattedText += `${content.example}`;
      } else if (content.text) {
        formattedText += `${content.text}`;
      } else if (content.description) {
        formattedText += `${content.description}`;
      } else {
        // Fallback to JSON representation
        formattedText += JSON.stringify(content);
      }

      if (content.reasoning) {
        formattedText += `\n   Reasoning: ${content.reasoning}`;
      }

      formattedText += '\n';
    }
  });

  formattedText += suffix;
  return formattedText;
};

/**
 * Inserts formatted memories into the request as a system message
 * @param context - The plugin context
 * @param memories - Formatted memories string to insert
 * @returns Transformed request data
 */
const insertMemories = (
  context: PluginContext,
  memories: string
): Record<string, any> => {
  const json = context.request.json;
  const updatedJson = { ...json };

  if (context.requestType === 'chatComplete') {
    const messages = [...json.messages];
    const systemIndex = messages.findIndex((msg) => msg.role === 'system');

    if (systemIndex !== -1) {
      // Append to existing system message
      messages[systemIndex] = {
        ...messages[systemIndex],
        content: messages[systemIndex].content + memories,
      };
    } else {
      // If no system message exists, add one
      messages.unshift({
        role: 'system',
        content: memories,
      });
    }

    updatedJson.messages = messages;
  } else {
    // For completion requests, prepend the memories
    updatedJson.prompt = memories + updatedJson.prompt;
  }

  return {
    request: {
      json: updatedJson,
    },
    response: {
      json: null,
    },
  };
};

/**
 * Main plugin handler for Skills Handbook memory retrieval
 */
export const handler: PluginHandler = async (
  context: PluginContext,
  parameters: PluginParameters,
  eventType: HookEventType
) => {
  let error = null;
  let verdict = true; // Always allow the request to continue
  let data: Record<string, any> = {};
  const transformedData: Record<string, any> = {
    request: {
      json: null,
    },
    response: {
      json: null,
    },
  };
  let transformed = false;

  try {
    // Only process before request and only for completion/chat completion
    if (
      eventType !== 'beforeRequestHook' ||
      (context.requestType !== 'complete' &&
        context.requestType !== 'chatComplete')
    ) {
      return {
        error: null,
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    const { content, textArray } = getCurrentContentPart(context, eventType);

    if (!content) {
      return {
        error: { message: 'request or response json is empty' },
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    // Combine all text parts into a single query
    const combinedQuery = textArray.join(' ').trim();

    if (!parameters.credentials) {
      return {
        error: { message: 'Missing credentials in parameters' },
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    const endpoint = parameters.credentials.endpoint;
    const apiKey = parameters.credentials.apiKey || '';
    const openaiApiKey = parameters.credentials.openaiApiKey;

    if (!openaiApiKey) {
      return {
        error: { message: 'Missing OpenAI API key in credentials' },
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    const topK = parameters.topK || 3;
    const scoreThreshold = parameters.scoreThreshold || 0.7;
    const timeout = parameters.timeout || 10000;

    let allMemories = '';

    // Query positive examples if enabled
    if (parameters.includePositive !== false) {
      const positiveCollection = parameters.positiveCollectionName || 'skills-handbook-positive';
      const positiveResult = await queryQdrant(
        combinedQuery,
        positiveCollection,
        endpoint,
        apiKey,
        openaiApiKey,
        topK,
        scoreThreshold,
        timeout
      );

      if (positiveResult.results) {
        const formattedPositive = formatMemoriesForPrompt(
          positiveResult.results,
          parameters.positivePrefix || '\n<positive_examples>\nThese are examples of correct usage:\n',
          parameters.positiveSuffix || '\n</positive_examples>'
        );
        allMemories += formattedPositive;

        data.positive = {
          collection: positiveCollection,
          count: positiveResult.results.length,
          examples: positiveResult.results.map((r) => ({
            id: r.id,
            score: r.score,
            content: r.content,
          })),
        };
      }
    }

    // Query negative examples if enabled
    if (parameters.includeNegative !== false) {
      const negativeCollection = parameters.negativeCollectionName || 'skills-handbook-negative';
      const negativeResult = await queryQdrant(
        combinedQuery,
        negativeCollection,
        endpoint,
        apiKey,
        openaiApiKey,
        topK,
        scoreThreshold,
        timeout
      );

      if (negativeResult.results) {
        const formattedNegative = formatMemoriesForPrompt(
          negativeResult.results,
          parameters.negativePrefix || '\n<negative_examples>\nThese are examples of incorrect usage to avoid:\n',
          parameters.negativeSuffix || '\n</negative_examples>'
        );
        allMemories += formattedNegative;

        data.negative = {
          collection: negativeCollection,
          count: negativeResult.results.length,
          examples: negativeResult.results.map((r) => ({
            id: r.id,
            score: r.score,
            content: r.content,
          })),
        };
      }
    }

    // If we have any memories, insert them into the request
    if (allMemories) {
      data.query = combinedQuery;
      const newTransformedData = insertMemories(context, allMemories);
      Object.assign(transformedData, newTransformedData);
      transformed = true;
    }
  } catch (e: any) {
    delete e.stack;
    error = e;
  }

  return { error, verdict, data, transformedData, transformed };
};
