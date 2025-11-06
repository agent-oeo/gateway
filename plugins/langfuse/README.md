# Langfuse Prompt Management Plugin

This plugin integrates with Langfuse prompt management to dynamically fetch and replace system prompts in chat completion requests.

## Overview

The Langfuse Prompt plugin fetches prompts from your Langfuse instance and replaces the system message in chat completion requests. This allows you to manage and version your system prompts externally using Langfuse's prompt management features.

## Features

- Fetches prompts from Langfuse by name and optional label/version
- Replaces existing system messages or creates new ones
- Supports both cloud and self-hosted Langfuse instances
- Credentials can be passed via parameters or environment variables

## Configuration

### Parameters

- **promptName** (required): The name of the prompt to fetch from Langfuse
- **promptLabel** (optional): The label/version of the prompt. If not specified, uses the latest production version
- **langfuseSecretKey** (optional): Your Langfuse secret key. Can also be set via `LANGFUSE_SECRET_KEY` environment variable
- **langfusePublicKey** (optional): Your Langfuse public key. Can also be set via `LANGFUSE_PUBLIC_KEY` environment variable
- **langfuseHost** (optional): Langfuse API host URL. Defaults to `https://cloud.langfuse.com`. Override for self-hosted instances
- **createIfMissing** (optional): If true, creates a new system message if none exists. If false, only replaces existing system message. Defaults to `true`

### Environment Variables

You can set these environment variables to avoid passing credentials in each request:

```bash
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_HOST="http://localhost:3000"  # For self-hosted instances
```

## Usage Examples

### Example 1: Basic Usage with Environment Variables

Set environment variables:
```bash
export LANGFUSE_SECRET_KEY="sk-lf-..."
export LANGFUSE_PUBLIC_KEY="pk-lf-..."
export LANGFUSE_HOST="http://localhost:3000"
```

Make a request with the plugin configured:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-portkey-api-key: sk-..." \
  -H "x-portkey-config: {\"inputMutators\": [{\"id\": \"custom.langfusePrompt\", \"parameters\": {\"promptName\": \"my-system-prompt\"}}]}" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Example 2: With Specific Prompt Label/Version

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-portkey-api-key: sk-..." \
  -H "x-portkey-config: {\"inputMutators\": [{\"id\": \"custom.langfusePrompt\", \"parameters\": {\"promptName\": \"my-system-prompt\", \"promptLabel\": \"v2.0\"}}]}" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Example 3: With Credentials in Parameters (Not Recommended for Production)

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-provider: openai" \
  -H "x-portkey-api-key: sk-..." \
  -H "x-portkey-config: {\"inputMutators\": [{\"id\": \"custom.langfusePrompt\", \"parameters\": {\"promptName\": \"my-system-prompt\", \"langfuseSecretKey\": \"sk-lf-...\", \"langfusePublicKey\": \"pk-lf-...\", \"langfuseHost\": \"http://localhost:3000\"}}]}" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Example 4: Using with Portkey Config JSON

Create a config file `config.json`:

```json
{
  "provider": "openai",
  "api_key": "sk-...",
  "inputMutators": [
    {
      "id": "custom.langfusePrompt",
      "parameters": {
        "promptName": "customer-support-prompt",
        "promptLabel": "production",
        "createIfMissing": true
      }
    }
  ]
}
```

Then use it in your request:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-portkey-config: $(cat config.json)" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "I need help with my order"}
    ]
  }'
```

### Example 5: Python SDK Usage

```python
import os
from openai import OpenAI

# Set Langfuse credentials as environment variables
os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-..."
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-..."
os.environ["LANGFUSE_HOST"] = "http://localhost:3000"

# Configure OpenAI client to use the gateway
client = OpenAI(
    base_url="http://localhost:8787/v1",
    api_key="dummy",  # Can be dummy since we pass real key in config
    default_headers={
        "x-portkey-config": json.dumps({
            "provider": "openai",
            "api_key": "sk-...",  # Your actual OpenAI API key
            "inputMutators": [{
                "id": "custom.langfusePrompt",
                "parameters": {
                    "promptName": "my-system-prompt",
                    "promptLabel": "v1.0"
                }
            }]
        })
    }
)

# Make request - system prompt will be fetched from Langfuse
response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello, how are you?"}
    ]
)

print(response.choices[0].message.content)
```

## How It Works

1. The plugin intercepts chat completion requests in the `beforeRequestHook` phase
2. It connects to your Langfuse instance using the provided credentials
3. Fetches the prompt by name (and optional label/version)
4. Replaces the system message in the request's messages array with the fetched prompt
5. If no system message exists and `createIfMissing` is true, it creates a new system message
6. The modified request is then sent to the AI provider

## Request Flow

```
Client Request
    ↓
Gateway receives request
    ↓
beforeRequestHook triggered
    ↓
Langfuse Prompt Plugin executes:
  - Fetches prompt from Langfuse
  - Replaces/creates system message
    ↓
Modified request sent to AI provider
    ↓
Response returned to client
```

## Error Handling

The plugin will return an error (but still allow the request) if:

- Langfuse credentials are missing
- The prompt name is not provided
- Langfuse API returns an error
- The prompt cannot be fetched

Errors are logged in the plugin response data for debugging.

## Best Practices

1. **Use environment variables** for credentials in production
2. **Version your prompts** using Langfuse labels for better control
3. **Test prompt changes** in a staging environment before deploying to production
4. **Monitor plugin errors** to catch issues with prompt fetching
5. **Cache prompts** if making high-volume requests (implement caching in future versions)

## Compatibility

- Works with `chatComplete` and `messages` request types
- Supports all AI providers that accept chat completion format
- Compatible with OpenAI, Anthropic, Azure, and other providers

## Future Enhancements

Potential improvements for future versions:

- Prompt caching to reduce Langfuse API calls
- Support for prompt variables/templating
- Fallback prompts if Langfuse is unavailable
- Metrics and monitoring integration
