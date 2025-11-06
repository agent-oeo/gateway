import { handler as observeToolsHandler } from './observeTools';
import { PluginContext } from '../types';

describe('tool-observer plugin', () => {
  jest.setTimeout(30000);

  it('should extract and return tool specifications from chat completion request', async () => {
    const context = {
      request: {
        json: {
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: 'What is the weather?',
            },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get the current weather for a location',
                parameters: {
                  type: 'object',
                  properties: {
                    location: {
                      type: 'string',
                      description: 'The city and state, e.g. San Francisco, CA',
                    },
                    unit: {
                      type: 'string',
                      enum: ['celsius', 'fahrenheit'],
                    },
                  },
                  required: ['location'],
                },
              },
            },
            {
              type: 'function',
              function: {
                name: 'get_forecast',
                description: 'Get the weather forecast',
                parameters: {
                  type: 'object',
                  properties: {
                    days: {
                      type: 'number',
                      description: 'Number of days to forecast',
                    },
                  },
                },
              },
            },
          ],
        },
      },
      requestType: 'chatComplete',
      provider: 'openai',
      metadata: { user_id: 'test-user' },
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data.toolCount).toBe(2);
    expect(result.data.toolNames).toEqual(['get_weather', 'get_forecast']);
    expect(result.data.requestType).toBe('chatComplete');
    expect(result.data.provider).toBe('openai');
    expect(result.data.model).toBe('gpt-4');
    expect(result.data.tools).toHaveLength(2);
    expect(result.data.tools[0]).toEqual({
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: expect.objectContaining({
        type: 'object',
        properties: expect.any(Object),
      }),
    });
    expect(result.data.tools[1]).toEqual({
      name: 'get_forecast',
      description: 'Get the weather forecast',
      parameters: expect.objectContaining({
        type: 'object',
      }),
    });
  });

  it('should handle requests with no tools gracefully', async () => {
    const context = {
      request: {
        json: {
          model: 'gpt-4',
          messages: [
            {
              role: 'user',
              content: 'Hello',
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data.message).toContain('No tools found');
  });

  it('should skip non-chatComplete requests', async () => {
    const context = {
      request: {
        json: {
          prompt: 'Hello world',
        },
      },
      requestType: 'complete',
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result).toBeDefined();
    expect(result.verdict).toBe(true);
    expect(result.error).toBeNull();
    expect(result.data.message).toContain('Not a chat completion request');
    expect(result.data.requestType).toBe('complete');
  });

  it('should handle tools with missing descriptions', async () => {
    const context = {
      request: {
        json: {
          messages: [{ role: 'user', content: 'test' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'minimal_tool',
                parameters: {
                  type: 'object',
                  properties: {},
                },
              },
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result.verdict).toBe(true);
    expect(result.data.toolCount).toBe(1);
    expect(result.data.tools[0].name).toBe('minimal_tool');
    expect(result.data.tools[0].description).toBe('');
  });

  it('should include metadata in returned data', async () => {
    const context = {
      request: {
        json: {
          model: 'claude-3-opus',
          messages: [{ role: 'user', content: 'test' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'search',
                description: 'Search for information',
                parameters: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                  },
                },
              },
            },
          ],
        },
      },
      requestType: 'chatComplete',
      provider: 'anthropic',
      metadata: {
        user_id: 'user-123',
        session_id: 'session-456',
        environment: 'production',
      },
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result.verdict).toBe(true);
    expect(result.data.provider).toBe('anthropic');
    expect(result.data.model).toBe('claude-3-opus');
    expect(result.data.metadata).toEqual({
      user_id: 'user-123',
      session_id: 'session-456',
      environment: 'production',
    });
  });

  it('should handle empty tools array', async () => {
    const context = {
      request: {
        json: {
          messages: [{ role: 'user', content: 'test' }],
          tools: [],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result.verdict).toBe(true);
    expect(result.data.message).toContain('No tools found');
  });

  it('should include timestamp in returned data', async () => {
    const context = {
      request: {
        json: {
          messages: [{ role: 'user', content: 'test' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'test_tool',
                parameters: {},
              },
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result.data.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it('should extract complex tool parameters correctly', async () => {
    const context = {
      request: {
        json: {
          messages: [{ role: 'user', content: 'test' }],
          tools: [
            {
              type: 'function',
              function: {
                name: 'complex_tool',
                description: 'A tool with complex parameters',
                parameters: {
                  type: 'object',
                  properties: {
                    nested: {
                      type: 'object',
                      properties: {
                        field: { type: 'string' },
                      },
                    },
                    array: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                  },
                  required: ['nested'],
                },
              },
            },
          ],
        },
      },
      requestType: 'chatComplete',
    };

    const parameters = {};

    const result = await observeToolsHandler(
      context as PluginContext,
      parameters,
      'beforeRequestHook'
    );

    expect(result.verdict).toBe(true);
    expect(result.data.tools[0].parameters).toEqual({
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            field: { type: 'string' },
          },
        },
        array: {
          type: 'array',
          items: { type: 'number' },
        },
      },
      required: ['nested'],
    });
  });
});
