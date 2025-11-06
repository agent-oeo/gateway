import {
  HookEventType,
  PluginContext,
  PluginHandler,
  PluginParameters,
} from '../types';
import { Langfuse } from 'langfuse';

/**
 * Replaces the system prompt in chat completion messages with a prompt from Langfuse
 */
const replaceLangfuseSystemPrompt = async (
  context: PluginContext,
  parameters: PluginParameters,
  eventType: HookEventType,
  options?: {
    env: Record<string, any>;
  }
): Promise<Record<string, any>> => {
  console.log('[Langfuse Plugin] replaceLangfuseSystemPrompt called');

  const transformedData: Record<string, any> = {
    request: { json: null },
    response: { json: null },
  };

  // Only process chat completions
  if (
    !context.request?.json?.messages ||
    !Array.isArray(context.request.json.messages)
  ) {
    throw new Error(
      'Langfuse prompt replacement only works with chat completion requests'
    );
  }

  const json = context.request.json;
  const updatedJson = { ...json };
  const messages = [...json.messages];

  // Get Langfuse credentials from parameters or environment
  const secretKey =
    parameters.langfuseSecretKey ||
    options?.env?.LANGFUSE_SECRET_KEY ||
    process.env.LANGFUSE_SECRET_KEY;
  const publicKey =
    parameters.langfusePublicKey ||
    options?.env?.LANGFUSE_PUBLIC_KEY ||
    process.env.LANGFUSE_PUBLIC_KEY;
  const host =
    parameters.langfuseHost ||
    options?.env?.LANGFUSE_HOST ||
    process.env.LANGFUSE_HOST ||
    'https://cloud.langfuse.com';

  console.log('[Langfuse Plugin] Langfuse host:', host);
  console.log('[Langfuse Plugin] Has secretKey:', !!secretKey);
  console.log('[Langfuse Plugin] Has publicKey:', !!publicKey);

  if (!secretKey || !publicKey) {
    throw new Error(
      'Langfuse credentials (secretKey and publicKey) are required. ' +
        'Provide them via parameters or environment variables LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY'
    );
  }

  // Initialize Langfuse client
  console.log('[Langfuse Plugin] Initializing Langfuse client...');
  const langfuse = new Langfuse({
    secretKey,
    publicKey,
    baseUrl: host,
  });

  // Fetch prompt from Langfuse
  const promptName = parameters.promptName;
  const promptLabel = parameters.promptLabel || undefined; // undefined = latest production

  console.log('[Langfuse Plugin] Fetching prompt:', promptName, 'label:', promptLabel || 'latest production');

  if (!promptName || typeof promptName !== 'string') {
    throw new Error('promptName parameter is required and must be a string');
  }

  let langfusePrompt;
  try {
    // Fetch the prompt using the correct API
    // getPrompt signature: (name: string, version?: number, options?: {...})
    // We need to pass undefined for version to use options
    const fetchOptions: any = {
      type: 'text', // Specify text type for system prompts
    };

    if (promptLabel) {
      fetchOptions.label = promptLabel;
    } else {
      // Get latest production version (default behavior)
      fetchOptions.label = 'production';
    }

    console.log('[Langfuse Plugin] Fetch options:', JSON.stringify(fetchOptions));
    console.log('[Langfuse Plugin] Calling getPrompt with name:', promptName, 'version: undefined, options:', fetchOptions);

    // Call with undefined version so options is the 3rd parameter
    langfusePrompt = await langfuse.getPrompt(promptName, undefined, fetchOptions);

    console.log('[Langfuse Plugin] Prompt fetched successfully');
    console.log('[Langfuse Plugin] Prompt object keys:', Object.keys(langfusePrompt || {}));
  } catch (error: any) {
    console.error('[Langfuse Plugin] Failed to fetch prompt:', error.message);
    throw new Error(
      `Failed to fetch prompt '${promptName}' from Langfuse: ${error.message}`
    );
  }

  // Extract the prompt content
  const promptContent = langfusePrompt.prompt;
  console.log('[Langfuse Plugin] Prompt content:', promptContent);

  if (!promptContent || typeof promptContent !== 'string') {
    throw new Error(
      `Langfuse prompt '${promptName}' returned invalid content`
    );
  }

  // Find existing system message
  const systemMessageIndex = messages.findIndex((msg) => msg.role === 'system');
  console.log('[Langfuse Plugin] System message index:', systemMessageIndex);

  if (systemMessageIndex !== -1) {
    // Replace existing system message
    console.log('[Langfuse Plugin] Replacing existing system message');
    messages[systemMessageIndex] = {
      ...messages[systemMessageIndex],
      content: promptContent,
    };
  } else if (parameters.createIfMissing !== false) {
    // Create new system message at the beginning
    console.log('[Langfuse Plugin] Creating new system message');
    const newSystemMessage = {
      role: 'system',
      content: promptContent,
    };
    messages.unshift(newSystemMessage);
  } else {
    console.log('[Langfuse Plugin] No system message and createIfMissing is false - no changes');
  }

  updatedJson.messages = messages;

  return {
    request: {
      json: updatedJson,
    },
    response: {
      json: null,
    },
  };
};

export const handler: PluginHandler = async (
  context: PluginContext,
  parameters: PluginParameters,
  eventType: HookEventType,
  options?: {
    env: Record<string, any>;
    getFromCacheByKey?: (key: string) => Promise<any>;
    putInCacheWithValue?: (key: string, value: any) => Promise<any>;
  }
) => {
  console.log('[Langfuse Plugin] Handler called');
  console.log('[Langfuse Plugin] Event type:', eventType);
  console.log('[Langfuse Plugin] Request type:', context.requestType);
  console.log('[Langfuse Plugin] Parameters:', JSON.stringify(parameters, null, 2));

  let error = null;
  let verdict = true; // Always allow the request to continue
  let data = null;
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
    // Only process before request for chat completion/messages
    if (
      eventType !== 'beforeRequestHook' ||
      !['chatComplete', 'messages'].includes(context.requestType || '')
    ) {
      console.log('[Langfuse Plugin] Skipping - not a beforeRequestHook for chat completion');
      return {
        error: null,
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    // Check if request JSON exists
    if (!context.request?.json) {
      console.log('[Langfuse Plugin] Error - Request JSON is empty or missing');
      return {
        error: { message: 'Request JSON is empty or missing' },
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    console.log('[Langfuse Plugin] Original messages:', JSON.stringify(context.request.json.messages, null, 2));

    // Replace system prompt with Langfuse prompt
    const newTransformedData = await replaceLangfuseSystemPrompt(
      context,
      parameters,
      eventType,
      options
    );

    Object.assign(transformedData, newTransformedData);
    transformed = true;

    console.log('[Langfuse Plugin] Transformed messages:', JSON.stringify(transformedData.request.json.messages, null, 2));
    console.log('[Langfuse Plugin] Transformation successful!');

    data = {
      promptName: parameters.promptName,
      promptLabel: parameters.promptLabel || 'latest production',
      langfuseHost:
        parameters.langfuseHost ||
        options?.env?.LANGFUSE_HOST ||
        'https://cloud.langfuse.com',
      systemPromptReplaced: true,
    };
  } catch (e: any) {
    console.error('[Langfuse Plugin] Error:', e.message);
    console.error('[Langfuse Plugin] Full error:', e);
    delete e.stack;
    error = {
      message: `Error in Langfuse prompt plugin: ${e.message || 'Unknown error'}`,
      originalError: e,
    };
  }

  console.log('[Langfuse Plugin] Returning - transformed:', transformed, 'error:', error);
  return { error, verdict, data, transformedData, transformed };
};
