import {
  HookEventType,
  PluginContext,
  PluginHandler,
  PluginParameters,
} from '../types';

/**
 * Adds ITS-Hub specific parameters (budget) to the request
 */
const addItsHubParameters = async (
  context: PluginContext,
  parameters: PluginParameters,
  eventType: HookEventType
): Promise<Record<string, any>> => {
  const transformedData: Record<string, any> = {
    request: { json: null },
    response: { json: null },
  };

  // Only process chat completions and completions
  if (!context.request?.json) {
    throw new Error('Request JSON is empty or missing');
  }

  const json = context.request.json;
  const updatedJson = { ...json };

  // Add budget parameter if provided
  const budget = parameters.budget;
  if (budget !== undefined && budget !== null) {
    if (typeof budget !== 'number' || budget <= 0) {
      throw new Error('budget parameter must be a positive number');
    }
    updatedJson.budget = budget;
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
    // Only process before request for chat completion/completions/messages
    if (
      eventType !== 'beforeRequestHook' ||
      !['chatComplete', 'complete', 'messages'].includes(context.requestType || '')
    ) {
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
      return {
        error: { message: 'Request JSON is empty or missing' },
        verdict: true,
        data: null,
        transformedData,
        transformed,
      };
    }

    // Add ITS-Hub parameters
    const newTransformedData = await addItsHubParameters(
      context,
      parameters,
      eventType
    );

    Object.assign(transformedData, newTransformedData);
    transformed = true;

    data = {
      budget: parameters.budget,
      itsHubParametersAdded: true,
    };
  } catch (e: any) {
    delete e.stack;
    error = {
      message: `Error in ITS-Hub plugin: ${e.message || 'Unknown error'}`,
      originalError: e,
    };
  }

  return { error, verdict, data, transformedData, transformed };
};
