import { handler as handbookHandler } from './handbook';
import { PluginContext } from '../types';
import * as utils from '../utils';

// Mock the post utility to avoid real API calls in tests
jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  post: jest.fn(),
}));

const mockPost = utils.post as jest.MockedFunction<typeof utils.post>;

describe('skills-handbook handler', () => {
  jest.setTimeout(30000);

  const mockCredentials = {
    apiKey: 'test-api-key',
    endpoint: 'https://test-qdrant.example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should only run on beforeRequestHook', async () => {
    const eventType = 'afterRequestHook';
    const context = {
      request: {
        text: 'How do I use the search API?',
        json: {
          messages: [
            {
              role: 'user',
              content: 'How do I use the search API?',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      topK: 3,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.error).toBeNull();
    expect(result.transformed).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should retrieve and insert positive examples only', async () => {
    const mockPositiveResults = {
      result: [
        {
          id: 1,
          score: 0.95,
          payload: {
            tool: 'search',
            example: 'Use the search endpoint with proper authentication',
            reasoning: 'Always include API key in headers',
          },
        },
        {
          id: 2,
          score: 0.88,
          payload: {
            tool: 'search',
            example: 'Include query parameters in the request body',
          },
        },
      ],
    };

    mockPost.mockResolvedValueOnce(mockPositiveResults);

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'How do I use the search API?',
        json: {
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            {
              role: 'user',
              content: 'How do I use the search API?',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      topK: 3,
      includePositive: true,
      includeNegative: false,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.error).toBeNull();
    expect(result.transformed).toBe(true);

    // Check that only positive query was made
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      'https://test-qdrant.example.com/collections/skills-handbook-positive/points/query',
      expect.objectContaining({
        query: 'How do I use the search API?',
        limit: 3,
      }),
      expect.any(Object),
      expect.any(Number)
    );

    // Check that system message was enhanced with positive examples
    const messages = result.transformedData.request.json.messages;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('You are a helpful assistant.');
    expect(messages[0].content).toContain('<positive_examples>');
    expect(messages[0].content).toContain('correct usage');
    expect(messages[0].content).toContain('Use the search endpoint with proper authentication');
    expect(messages[0].content).not.toContain('<negative_examples>');

    // Check metadata
    expect(result.data.positive).toBeDefined();
    expect(result.data.positive.count).toBe(2);
    expect(result.data.negative).toBeUndefined();
  });

  it('should retrieve and insert both positive and negative examples', async () => {
    const mockPositiveResults = {
      result: [
        {
          id: 1,
          score: 0.95,
          payload: {
            example: 'Always validate input parameters',
          },
        },
      ],
    };

    const mockNegativeResults = {
      result: [
        {
          id: 2,
          score: 0.90,
          payload: {
            example: 'Never skip authentication',
          },
        },
      ],
    };

    mockPost
      .mockResolvedValueOnce(mockPositiveResults)
      .mockResolvedValueOnce(mockNegativeResults);

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'How do I use the API?',
        json: {
          messages: [
            {
              role: 'user',
              content: 'How do I use the API?',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      topK: 2,
      includePositive: true,
      includeNegative: true,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.error).toBeNull();
    expect(result.transformed).toBe(true);

    // Check that both queries were made
    expect(mockPost).toHaveBeenCalledTimes(2);

    // Check that a new system message was added with both types
    const messages = result.transformedData.request.json.messages;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('<positive_examples>');
    expect(messages[0].content).toContain('Always validate input parameters');
    expect(messages[0].content).toContain('<negative_examples>');
    expect(messages[0].content).toContain('Never skip authentication');

    // Check metadata
    expect(result.data.positive).toBeDefined();
    expect(result.data.negative).toBeDefined();
    expect(result.data.positive.count).toBe(1);
    expect(result.data.negative.count).toBe(1);
  });

  it('should use custom collection names', async () => {
    const mockResults = {
      result: [
        {
          id: 1,
          score: 0.85,
          payload: { text: 'Example memory' },
        },
      ],
    };

    mockPost
      .mockResolvedValueOnce(mockResults)
      .mockResolvedValueOnce(mockResults);

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Test query',
        json: {
          messages: [
            {
              role: 'user',
              content: 'Test query',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      positiveCollectionName: 'custom-positive',
      negativeCollectionName: 'custom-negative',
      topK: 1,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(mockPost).toHaveBeenCalledWith(
      'https://test-qdrant.example.com/collections/custom-positive/points/query',
      expect.any(Object),
      expect.any(Object),
      expect.any(Number)
    );

    expect(mockPost).toHaveBeenCalledWith(
      'https://test-qdrant.example.com/collections/custom-negative/points/query',
      expect.any(Object),
      expect.any(Object),
      expect.any(Number)
    );

    expect(result.data.positive.collection).toBe('custom-positive');
    expect(result.data.negative.collection).toBe('custom-negative');
  });

  it('should use custom prefix and suffix for positive and negative examples', async () => {
    const mockResults = {
      result: [
        {
          id: 1,
          score: 0.85,
          payload: { text: 'Example' },
        },
      ],
    };

    mockPost
      .mockResolvedValueOnce(mockResults)
      .mockResolvedValueOnce(mockResults);

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Test',
        json: {
          messages: [
            {
              role: 'user',
              content: 'Test',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      positivePrefix: '\n[GOOD_EXAMPLES]',
      positiveSuffix: '[/GOOD_EXAMPLES]\n',
      negativePrefix: '\n[BAD_EXAMPLES]',
      negativeSuffix: '[/BAD_EXAMPLES]\n',
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    const content = result.transformedData.request.json.messages[0].content;
    expect(content).toContain('[GOOD_EXAMPLES]');
    expect(content).toContain('[/GOOD_EXAMPLES]');
    expect(content).toContain('[BAD_EXAMPLES]');
    expect(content).toContain('[/BAD_EXAMPLES]');
    expect(content).not.toContain('<positive_examples>');
    expect(content).not.toContain('<negative_examples>');
  });

  it('should handle completion requests by prepending memories', async () => {
    const mockResults = {
      result: [
        {
          id: 1,
          score: 0.90,
          payload: { text: 'Example memory' },
        },
      ],
    };

    mockPost.mockResolvedValueOnce(mockResults);

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Test prompt',
        json: {
          prompt: 'Test prompt',
        },
      },
      requestType: 'complete',
    };

    const parameters = {
      credentials: mockCredentials,
      includeNegative: false,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.transformed).toBe(true);

    // Check that prompt was enhanced
    const prompt = result.transformedData.request.json.prompt;
    expect(prompt).toContain('<positive_examples>');
    expect(prompt).toContain('Example memory');
    expect(prompt).toContain('Test prompt');
    expect(prompt.indexOf('<positive_examples>')).toBeLessThan(
      prompt.indexOf('Test prompt')
    );
  });

  it('should handle empty results gracefully', async () => {
    mockPost
      .mockResolvedValueOnce({ result: [] })
      .mockResolvedValueOnce({ result: [] });

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Unrelated query',
        json: {
          messages: [
            {
              role: 'user',
              content: 'Unrelated query',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.transformed).toBe(false);
  });

  it('should apply score threshold correctly', async () => {
    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Test',
        json: {
          messages: [
            {
              role: 'user',
              content: 'Test',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      scoreThreshold: 0.85,
      includeNegative: false,
    };

    mockPost.mockResolvedValueOnce({ result: [] });

    await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        score_threshold: 0.85,
      }),
      expect.any(Object),
      expect.any(Number)
    );
  });

  it('should handle API errors gracefully', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'));

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Test',
        json: {
          messages: [
            {
              role: 'user',
              content: 'Test',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      includeNegative: false,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    // Should still return a valid response even on error
    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.transformed).toBe(false);
  });

  it('should handle empty query gracefully', async () => {
    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: '',
        json: {
          messages: [
            {
              role: 'user',
              content: '',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.transformed).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('should handle different payload structures', async () => {
    const mockResults = {
      result: [
        {
          id: 1,
          score: 0.95,
          payload: 'Simple string payload',
        },
        {
          id: 2,
          score: 0.90,
          payload: {
            description: 'Payload with description field',
          },
        },
        {
          id: 3,
          score: 0.85,
          payload: {
            text: 'Payload with text field',
          },
        },
      ],
    };

    mockPost.mockResolvedValueOnce(mockResults);

    const eventType = 'beforeRequestHook';
    const context = {
      request: {
        text: 'Test',
        json: {
          messages: [
            {
              role: 'user',
              content: 'Test',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {
      credentials: mockCredentials,
      includeNegative: false,
    };

    const result = await handbookHandler(
      context as PluginContext,
      parameters,
      eventType
    );

    expect(result.transformed).toBe(true);
    const content = result.transformedData.request.json.messages[0].content;

    // Should handle all different payload types
    expect(content).toContain('Simple string payload');
    expect(content).toContain('Payload with description field');
    expect(content).toContain('Payload with text field');
  });
});
