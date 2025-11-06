# Tool Observer Plugin

The **Tool Observer** plugin extracts and returns complete tool specifications from chat completion requests in the response metadata. It captures tool names, descriptions, and full parameter schemas without modifying the actual chat completion response.

## Features

- ✅ **Zero Configuration** - No parameters required
- ✅ **Complete Extraction** - Captures tool names, descriptions, and full parameter schemas
- ✅ **Non-Invasive** - Returns data in metadata, doesn't modify the chat response
- ✅ **Provider Agnostic** - Works with OpenAI, Anthropic, and all supported providers
- ✅ **Always Allows** - Never blocks requests, always returns `verdict: true`

## Use Cases

- **Observability** - Track which tools are being used in requests
- **Analytics** - Analyze tool usage patterns across your application
- **Debugging** - Inspect tool specifications being sent to models
- **Compliance** - Audit tool definitions for security/compliance purposes
- **Monitoring** - Monitor tool complexity and parameter schemas

## Installation

### Step 1: Enable the Plugin

Add `"tool-observer"` to the `plugins_enabled` array in `conf.json`:

```json
{
  "plugins_enabled": [
    "default",
    "tool-observer"
  ]
}
```

### Step 2: Build the Plugins

Build the plugins to register the tool-observer:

```bash
npm run build-plugins
```

### Step 3: Start the Gateway

```bash
npm run dev:node
```

Now the plugin is ready to use. Add it to your configuration:

```json
{
  "input_guardrails": [
    {
      "tool-observer.observeTools": {}
    }
  ]
}
```

## Configuration

### Parameters

The plugin requires **no parameters**. Simply include it in your `input_guardrails`:

```json
{
  "strategy": {
    "mode": "single"
  },
  "targets": [
    {
      "provider": "openai",
      "api_key": "sk-***"
    }
  ],
  "input_guardrails": [
    {
      "tool-observer.observeTools": {}
    }
  ]
}
```

## Usage - Two Ways to Enable

There are **two ways** to use the tool-observer plugin:

### Method 1: Gateway Config (Always On)

Add the plugin to your gateway configuration file. This enables it for **all requests** through the gateway.

**In your gateway config** (`config.json` or via environment):

```json
{
  "strategy": {
    "mode": "single"
  },
  "targets": [
    {
      "provider": "openai",
      "api_key": "sk-***"
    }
  ],
  "input_guardrails": [
    {
      "tool-observer.observeTools": {}
    }
  ]
}
```

**Then make normal requests** - the plugin runs automatically:

```python
from portkey_ai import Portkey

portkey = Portkey(
    api_key="your-openai-key",
    base_url="http://localhost:8787/v1"
)

# Plugin runs automatically - no config needed in request
response = portkey.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What's the weather?"}],
    tools=[...]
)

# Tool specs are in response metadata
tool_data = response.hook_results['before_request_hooks'][0]['checks'][0]['data']
```

---

### Method 2: Per-Request Config (Selective)

Pass the plugin config with **each individual request**. This lets you enable/disable it per request.

**Python - Inline Config:**

```python
from portkey_ai import Portkey

portkey = Portkey(
    api_key="your-openai-key",
    base_url="http://localhost:8787/v1"
)

# Define config for this request
config = {
    "input_guardrails": [{
        "tool-observer.observeTools": {}
    }]
}

# Pass config with the request
response = portkey.with_options(config=config).chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "What's the weather?"}],
    tools=[...]
)
```

**cURL:**

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-config: '{\"input_guardrails\":[{\"tool-observer.observeTools\":{}}]}'" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "What is the weather?"}],
    "tools": [...]
  }'
```

---

## Response Structure

Tool specifications are returned in the `hook_results` metadata:

```json
{
  "choices": [...],
  "usage": {...},
  "model": "gpt-4",

  "hook_results": {
    "before_request_hooks": [
      {
        "verdict": true,
        "checks": [
          {
            "id": "tool-observer.observeTools",
            "verdict": true,
            "execution_time": 13,
            "data": {
              "timestamp": "2025-11-06T20:15:00.000Z",
              "requestType": "chatComplete",
              "provider": "openai",
              "model": "gpt-4",
              "metadata": {...},
              "toolCount": 1,
              "toolNames": ["get_weather"],
              "tools": [
                {
                  "name": "get_weather",
                  "description": "Get current weather",
                  "parameters": {
                    "type": "object",
                    "properties": {
                      "location": {"type": "string"}
                    },
                    "required": ["location"]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

## Returned Data Fields

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | string | ISO 8601 timestamp when observation occurred |
| `requestType` | string | Type of request (e.g., "chatComplete") |
| `provider` | string | Provider name (e.g., "openai", "anthropic") |
| `model` | string | Model name from the request |
| `metadata` | object | Custom metadata from the request (if any) |
| `toolCount` | number | Number of tools in the request |
| `toolNames` | string[] | Array of tool function names |
| `tools` | object[] | Complete tool specifications |

### Tool Specification Object

Each tool in the `tools` array contains:

```typescript
{
  name: string;           // Function name
  description: string;    // Function description (or empty string)
  parameters: object;     // Full JSON schema for parameters
}
```

## Behavior

- **When tools are present**: Extracts and returns complete specifications
- **When no tools**: Returns `{message: "No tools found in request"}`
- **Non-chat requests**: Returns `{message: "Not a chat completion request", requestType: "..."}`
- **Always allows**: Never blocks requests, always returns `verdict: true`

## Integration with Other Guardrails

The tool observer works seamlessly with other guardrails:

```json
{
  "input_guardrails": [
    {
      "tool-observer.observeTools": {}
    },
    {
      "default.modelwhitelist": {
        "models": ["gpt-4", "gpt-4-turbo"]
      }
    },
    {
      "portkey.moderateContent": {}
    }
  ]
}
```

All guardrails execute in sequence, and their results are available in `hook_results`.
