import { PluginContext, PluginHandler, PluginParameters } from '../types';

interface ToolFunction {
  name: string;
  description?: string;
  parameters?: any;
}

interface Tool {
  type: string;
  function: ToolFunction;
}

interface ExtractedToolSpec {
  name: string;
  description: string;
  parameters: any;
}

/**
 * Extracts tool specifications from the request
 * @param context - The plugin context containing request data
 * @returns Array of extracted tool specifications
 */
const extractToolSpecs = (context: PluginContext): ExtractedToolSpec[] => {
  const tools: Tool[] = context.request?.json?.tools;

  if (!tools || !Array.isArray(tools) || tools.length === 0) {
    return [];
  }

  return tools.map((tool) => {
    const func = tool.function || ({} as ToolFunction);
    return {
      name: func.name || 'unknown',
      description: func.description || '',
      parameters: func.parameters || {},
    };
  });
};

/**
 * Main plugin handler for tool observation
 * Returns tool specifications in the response metadata
 */
export const handler: PluginHandler = async (
  context: PluginContext,
  parameters: PluginParameters
) => {
  let error = null;
  let verdict = true; // Always allow the request to continue
  let data = null;

  try {
    // Only process chat completion requests
    if (context.requestType !== 'chatComplete') {
      return {
        error: null,
        verdict: true,
        data: {
          message: 'Not a chat completion request, skipping tool observation',
          requestType: context.requestType,
        },
      };
    }

    // Extract tool specifications
    const toolSpecs = extractToolSpecs(context);

    if (toolSpecs.length === 0) {
      return {
        error: null,
        verdict: true,
        data: {
          message: 'No tools found in request',
        },
      };
    }

    // Return tool specs in response metadata
    data = {
      timestamp: new Date().toISOString(),
      requestType: context.requestType,
      provider: context.provider,
      model: context.request?.json?.model,
      metadata: context.metadata,
      toolCount: toolSpecs.length,
      toolNames: toolSpecs.map((t) => t.name),
      tools: toolSpecs,
    };
  } catch (e: any) {
    delete e.stack;
    error = e;
    // Even on error, don't block the request
    verdict = true;
  }

  return { error, verdict, data };
};
