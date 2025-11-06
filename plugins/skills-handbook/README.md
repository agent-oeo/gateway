# Skills Handbook Plugin

A Portkey AI Gateway plugin that retrieves relevant positive and negative examples from Qdrant vector database and adds them as context to enhance AI responses with learned behaviors.

## Overview

The Skills Handbook plugin implements a per-tool instance memory system that stores positive and negative examples to guide the agent during inference. It works by:

1. User sends a prompt
2. Portkey intercepts the request
3. Plugin queries Qdrant for relevant memories
4. Memories are added as context to the original prompt
5. Enhanced prompt is sent to the LLM

## Quick Start

### Prerequisites

1. **Qdrant Instance**: `docker run -p 6333:6333 qdrant/qdrant`
2. **OpenAI API Key**: For both LLM calls and embeddings
3. **Python dependencies**: `uv pip install qdrant-client openai requests`

### Step 1: Set up Qdrant with Sample Data

Run the setup script to create collections with OpenAI embeddings:

```bash
uv run python plugins/skills-handbook/setup_qdrant.py \
  --url http://localhost:6333 \
  --openai-key "your-openai-api-key"
```

This creates two collections with real embeddings:
- `skills-handbook-positive` - 8 examples of correct API usage
- `skills-handbook-negative` - 8 examples of incorrect usage to avoid

### Step 2: Build and Start the Gateway

```bash
# Build plugins
uv run npm run build-plugins

# Start gateway (Node.js runtime)
uv run npm run dev:node
```

### Step 3: Test the Plugin

```bash
uv run python plugins/skills-handbook/test_integration.py \
  --api-key "your-openai-api-key" \
  --openai-key "your-openai-api-key"
```

**See [SETUP.md](SETUP.md) for detailed setup instructions and troubleshooting.**

## Usage Examples

### Dynamic Config Per Request (Recommended!)

The most flexible way is to pass the config directly in each request:

```python
from portkey_ai import Portkey

portkey = Portkey(
    base_url="http://localhost:8787",
    api_key="your-openai-key"
)

# Request WITHOUT memory - just omit config
response1 = portkey.chat.completions.create(
    messages=[{"role": "user", "content": "How to handle API auth?"}],
    model="gpt-3.5-turbo"
)

# Request WITH memory - pass config
response2 = portkey.chat.completions.create(
    messages=[{"role": "user", "content": "How to handle API auth?"}],
    model="gpt-3.5-turbo",
    config={
        "input_guardrails": [{
            "id": "skills-handbook",
            "type": "mutator",
            "skills-handbook.handbook": {
                "credentials": {
                    "endpoint": "http://localhost:6333",
                    "apiKey": "",
                    "openaiApiKey": "your-openai-key"
                },
                "topK": 3,
                "scoreThreshold": 0.5,
                "includePositive": True,
                "includeNegative": True
            }
        }]
    }
)

# Request with DIFFERENT settings
response3 = portkey.chat.completions.create(
    messages=[{"role": "user", "content": "API mistakes to avoid?"}],
    model="gpt-3.5-turbo",
    config={
        "input_guardrails": [{
            "id": "skills-handbook",
            "type": "mutator",
            "skills-handbook.handbook": {
                "credentials": {
                    "endpoint": "http://localhost:6333",
                    "apiKey": "",
                    "openaiApiKey": "your-openai-key"
                },
                "topK": 5,
                "includePositive": False,  # Only negatives!
                "includeNegative": True
            }
        }]
    }
)
```

**See [demo.ipynb](demo.ipynb) for interactive examples!**

### Using curl

```bash
curl -X POST "http://localhost:8787/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H 'x-portkey-config: {
    "strategy": {"mode": "single"},
    "targets": [{"provider": "openai", "api_key": "your-key"}],
    "input_guardrails": [{
      "id": "skills-handbook",
      "type": "mutator",
      "skills-handbook.handbook": {
        "credentials": {
          "endpoint": "http://localhost:6333",
          "apiKey": "",
          "openaiApiKey": "your-openai-key"
        },
        "topK": 3,
        "scoreThreshold": 0.5,
        "includePositive": true,
        "includeNegative": true
      }
    }]
  }' \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "How should I handle API authentication?"}
    ]
  }'
```

### Using Python

```python
import requests
import json

gateway_url = "http://localhost:8787/v1/chat/completions"

config = {
    "strategy": {"mode": "single"},
    "targets": [{"provider": "openai"}],
    "input_guardrails": [{
        "id": "skills-handbook-handbook",
        "credentials": {
            "endpoint": "http://localhost:6333",
            "apiKey": ""
        },
        "positiveCollectionName": "skills-handbook-positive",
        "negativeCollectionName": "skills-handbook-negative",
        "topK": 3,
        "scoreThreshold": 0.7,
        "includePositive": True,
        "includeNegative": True
    }]
}

response = requests.post(
    gateway_url,
    headers={
        "Content-Type": "application/json",
        "x-portkey-api-key": "YOUR_OPENAI_API_KEY",
        "x-portkey-provider": "openai",
        "x-portkey-config": json.dumps(config)
    },
    json={
        "model": "gpt-3.5-turbo",
        "messages": [
            {"role": "user", "content": "How should I handle API authentication?"}
        ]
    }
)

print(response.json())
```

### Using JavaScript/TypeScript

```javascript
const response = await fetch('http://localhost:8787/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-portkey-api-key': 'YOUR_OPENAI_API_KEY',
    'x-portkey-provider': 'openai',
    'x-portkey-config': JSON.stringify({
      strategy: { mode: 'single' },
      targets: [{ provider: 'openai' }],
      input_guardrails: [{
        id: 'skills-handbook-handbook',
        credentials: {
          endpoint: 'http://localhost:6333',
          apiKey: ''
        },
        topK: 3,
        scoreThreshold: 0.7,
        includePositive: true,
        includeNegative: true
      }]
    })
  },
  body: JSON.stringify({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: 'How should I handle API authentication?' }
    ]
  })
});

const data = await response.json();
console.log(data);
```

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `credentials.endpoint` | string | required | Qdrant instance URL |
| `credentials.apiKey` | string | `""` | Qdrant API key (empty for local) |
| `credentials.openaiApiKey` | string | required | OpenAI API key for embeddings |
| `positiveCollectionName` | string | `skills-handbook-positive` | Collection for positive examples |
| `negativeCollectionName` | string | `skills-handbook-negative` | Collection for negative examples |
| `topK` | number | `3` | Number of examples to retrieve |
| `scoreThreshold` | number | `0.7` | Minimum similarity score (0.0-1.0) |
| `includePositive` | boolean | `true` | Include positive examples |
| `includeNegative` | boolean | `true` | Include negative examples |
| `positivePrefix` | string | `\n<positive_examples>\n...` | Prefix for positive section |
| `positiveSuffix` | string | `\n</positive_examples>` | Suffix for positive section |
| `negativePrefix` | string | `\n<negative_examples>\n...` | Prefix for negative section |
| `negativeSuffix` | string | `\n</negative_examples>` | Suffix for negative section |
| `timeout` | number | `10000` | Qdrant API timeout (ms) |

## How It Works

### 1. Request Interception

When a request comes in with the plugin configured, it's intercepted before reaching the LLM.

### 2. Memory Retrieval

The plugin:
- Extracts the user's query from the request
- Generates an OpenAI embedding (text-embedding-3-small) of the query
- Queries Qdrant's positive collection for semantically similar good examples
- Queries Qdrant's negative collection for semantically similar bad examples to avoid
- Filters results by similarity score threshold

### 3. Context Injection

Retrieved memories are formatted and injected into the request:

```xml
<positive_examples>
These are examples of correct usage:
1. [Tool: api] Always validate authentication tokens before processing requests
   Reasoning: Security best practice to prevent unauthorized access
2. [Tool: api] Include proper error handling with try-catch blocks around API calls
   Reasoning: Prevents application crashes and provides better user feedback
...
</positive_examples>

<negative_examples>
These are examples of incorrect usage to avoid:
1. [Tool: api] Never skip authentication checks assuming requests are safe
   Reasoning: Opens security vulnerabilities and allows unauthorized access
2. [Tool: api] Don't ignore error responses from the API
   Reasoning: Can lead to silent failures and data inconsistencies
...
</negative_examples>
```

### 4. Enhanced Prompt

For chat completions, memories are added to the system message. For text completions, they're prepended to the prompt.

## Production Setup

### Adding Your Own Examples

The plugin uses OpenAI embeddings (text-embedding-3-small). To add your own examples:

```python
from qdrant_client import QdrantClient
from openai import OpenAI

client = QdrantClient(url="http://localhost:6333")
openai_client = OpenAI(api_key="your-key")

# Create embedding
text = "Always validate authentication tokens before processing requests"
embedding = openai_client.embeddings.create(
    input=text,
    model="text-embedding-3-small"
).data[0].embedding

# Add to Qdrant
client.upsert(
    collection_name="skills-handbook-positive",
    points=[{
        "id": 100,  # Use unique ID
        "vector": embedding,
        "payload": {
            "text": text,
            "tool": "api",
            "reasoning": "Security best practice to prevent unauthorized access"
        }
    }]
)
```

**Tip**: Modify `setup_qdrant.py` to include your examples, then re-run it.

### Qdrant Cloud

For production, use Qdrant Cloud:

1. Sign up at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a cluster
3. Get your API key and cluster URL
4. Update your config:

```json
{
  "credentials": {
    "endpoint": "https://your-cluster.qdrant.io",
    "apiKey": "your-api-key"
  }
}
```

### Security Best Practices

- Never commit API keys to version control
- Use environment variables for credentials
- Enable authentication on your Qdrant instance
- Use HTTPS for Qdrant endpoints in production
- Set appropriate score thresholds to filter low-quality matches

## Troubleshooting

### Plugin not working?

1. **Check plugin is enabled**: Verify `"skills-handbook"` is in `conf.json` `plugins_enabled`
2. **Rebuild plugins**: Run `npm run build-plugins`
3. **Check Qdrant connection**: Verify Qdrant is accessible at the endpoint URL
4. **Check collections exist**: Run the setup script
5. **Check API key**: Ensure Qdrant API key is correct (if using authentication)

### No memories retrieved?

1. **Check score threshold**: Try lowering `scoreThreshold` (e.g., `0.0` for testing)
2. **Check collections have data**: Query Qdrant directly to verify
3. **Use real embeddings**: Dummy vectors won't match semantically
4. **Check collection names**: Ensure they match your Qdrant collections

### Gateway errors?

1. **Check gateway logs**: Look for plugin error messages
2. **Test without plugin**: Verify gateway works without the plugin
3. **Check timeout**: Increase `timeout` if Qdrant is slow

## Testing

Run the unit tests:

```bash
npm run test:plugins -- --testPathPattern=skills-handbook
```

Run the integration test:

```bash
python plugins/skills-handbook/test_integration.py \
  --gateway-url http://localhost:8787 \
  --provider openai \
  --api-key $OPENAI_API_KEY \
  --qdrant-url http://localhost:6333
```

## Architecture

```
User Request
    ↓
Portkey Gateway
    ↓
Skills Handbook Plugin (beforeRequestHook)
    ↓
Query Qdrant (positive & negative collections)
    ↓
Format & Inject Memories
    ↓
Enhanced Request → LLM Provider
    ↓
Response to User
```

## License

Same as Portkey AI Gateway
