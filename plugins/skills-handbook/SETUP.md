# Skills Handbook Plugin - Complete Setup Guide

This guide will walk you through setting up and testing the Skills Handbook plugin from scratch.

## Overview

The Skills Handbook plugin enhances AI responses by retrieving relevant positive and negative examples from a Qdrant vector database and injecting them as context before the LLM processes requests.

## Prerequisites

- Docker (for running Qdrant)
- Node.js 18+ (for the gateway)
- Python 3.8+ (for setup scripts)
- OpenAI API key

## Step 1: Start Qdrant

Start a local Qdrant instance using Docker:

```bash
docker run -p 6333:6333 -p 6334:6334 \
    -v $(pwd)/qdrant_storage:/qdrant/storage:z \
    qdrant/qdrant
```

Verify Qdrant is running:
```bash
curl http://localhost:6333/collections
# Should return: {"result":{"collections":[]},"status":"ok","time":...}
```

## Step 2: Install Python Dependencies

```bash
# Install required packages
uv pip install qdrant-client openai requests
```

## Step 3: Set Up Your API Keys

Create or update `.env` file in the gateway root:

```bash
OPENAI_API_KEY=your-openai-api-key-here
```

## Step 4: Populate Qdrant with Sample Data

Run the setup script to create collections and add sample examples:

```bash
cd plugins/skills-handbook

# Using the OPENAI_API_KEY from .env
uv run python setup_qdrant.py \
  --url http://localhost:6333 \
  --openai-key "your-openai-api-key"
```

This will:
- Create two collections: `skills-handbook-positive` and `skills-handbook-negative`
- Generate OpenAI embeddings for 8 positive and 8 negative examples
- Store them in Qdrant with 1536-dimensional vectors (text-embedding-3-small)

You should see output like:
```
Connected to Qdrant at http://localhost:6333
Using OpenAI embeddings with text-embedding-3-small model

Creating collection: skills-handbook-positive
  Created skills-handbook-positive

Adding 8 positive examples...
  Generating embedding for: Always validate authentication tokens...
  ...
  Added 8 points to skills-handbook-positive

Setup complete! Collections created:
  - skills-handbook-positive: 8 points
  - skills-handbook-negative: 8 points
```

## Step 5: Enable the Plugin in Gateway

The plugin is already enabled in `conf.json`:

```json
{
  "plugins_enabled": [
    "default",
    "portkey",
    "skills-handbook",
    ...
  ]
}
```

Build the plugins:

```bash
# From the gateway root directory
uv run npm run build-plugins
```

## Step 6: Start the Gateway

```bash
uv run npm run dev:node
```

You should see:
```
🚀 Your AI Gateway is running at:
   http://localhost:8787

✨ Ready for connections!
```

## Step 7: Test the Plugin

### Option A: Run the Integration Test

```bash
cd plugins/skills-handbook

uv run python test_integration.py \
  --gateway-url http://localhost:8787 \
  --provider openai \
  --api-key "your-openai-api-key" \
  --qdrant-url http://localhost:6333 \
  --openai-key "your-openai-api-key"
```

Expected output:
```
================================================================================
Testing Skills Handbook Plugin Integration
================================================================================

Gateway URL: http://localhost:8787
Provider: openai
Qdrant URL: http://localhost:6333

Test Query: How should I handle API authentication in my application?

✅ Request successful!

Response:
================================================================================
A: To handle API authentication in your application, follow these best practices:

1. Always validate authentication tokens before processing requests
   Reasoning: Security best practice to prevent unauthorized access
...
```

### Option B: Test with cURL

```bash
curl -X POST "http://localhost:8787/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H 'x-portkey-config: {
    "strategy": {"mode": "single"},
    "targets": [{"provider": "openai", "api_key": "your-openai-api-key"}],
    "input_guardrails": [{
      "id": "skills-handbook",
      "type": "mutator",
      "skills-handbook.handbook": {
        "credentials": {
          "endpoint": "http://localhost:6333",
          "apiKey": "",
          "openaiApiKey": "your-openai-api-key"
        },
        "positiveCollectionName": "skills-handbook-positive",
        "negativeCollectionName": "skills-handbook-negative",
        "topK": 3,
        "scoreThreshold": 0.5,
        "includePositive": true,
        "includeNegative": true
      }
    }]
  }' \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "How should I handle API authentication?"}],
    "max_tokens": 200
  }'
```

### Option C: Test with Python SDK

Open the Jupyter notebook:

```bash
cd plugins/skills-handbook
jupyter notebook demo.ipynb
```

Or run this Python script:

```python
from portkey_ai import Portkey
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

portkey = Portkey(
    base_url="http://localhost:8787",
    api_key=OPENAI_API_KEY
)

# Request WITH memory
response = portkey.chat.completions.create(
    messages=[{"role": "user", "content": "How to handle API authentication?"}],
    model="gpt-3.5-turbo",
    config={
        "input_guardrails": [{
            "id": "skills-handbook",
            "type": "mutator",
            "skills-handbook.handbook": {
                "credentials": {
                    "endpoint": "http://localhost:6333",
                    "apiKey": "",
                    "openaiApiKey": OPENAI_API_KEY
                },
                "topK": 3,
                "scoreThreshold": 0.5,
                "includePositive": True,
                "includeNegative": True
            }
        }]
    }
)

print(response.choices[0].message.content)
```

## Verification Checklist

✅ Qdrant is running on port 6333
✅ Collections have 8 points each
✅ Gateway is running on port 8787
✅ Plugin responds with relevant examples from Qdrant
✅ LLM response includes content from your positive/negative examples

## How It Works

1. **Request arrives** at the gateway with the plugin enabled
2. **Plugin extracts** the user's query text
3. **OpenAI embedding** is generated for the query
4. **Qdrant search** finds semantically similar examples
5. **Examples are formatted** and injected into the system message
6. **LLM receives** the enhanced prompt with examples
7. **Response reflects** the guidance from your examples

## Configuration Options

### Plugin Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `credentials.endpoint` | string | - | Qdrant instance URL |
| `credentials.apiKey` | string | "" | Qdrant API key (empty for local) |
| `credentials.openaiApiKey` | string | - | OpenAI API key for embeddings |
| `positiveCollectionName` | string | "skills-handbook-positive" | Collection name for positive examples |
| `negativeCollectionName` | string | "skills-handbook-negative" | Collection name for negative examples |
| `topK` | number | 3 | Number of examples to retrieve |
| `scoreThreshold` | number | 0.7 | Minimum similarity score (0.0-1.0) |
| `includePositive` | boolean | true | Include positive examples |
| `includeNegative` | boolean | true | Include negative examples |
| `positivePrefix` | string | "\n<positive_examples>..." | Text before positive examples |
| `positiveSuffix` | string | "\n</positive_examples>" | Text after positive examples |
| `negativePrefix` | string | "\n<negative_examples>..." | Text before negative examples |
| `negativeSuffix` | string | "\n</negative_examples>" | Text after negative examples |
| `timeout` | number | 10000 | Timeout for Qdrant queries (ms) |

### Example: Custom Configuration

```json
{
  "input_guardrails": [{
    "id": "skills-handbook",
    "type": "mutator",
    "skills-handbook.handbook": {
      "credentials": {
        "endpoint": "http://localhost:6333",
        "apiKey": "",
        "openaiApiKey": "sk-..."
      },
      "topK": 5,
      "scoreThreshold": 0.6,
      "includePositive": true,
      "includeNegative": false,
      "positivePrefix": "\n## Best Practices:\n",
      "positiveSuffix": "\n---\n"
    }
  }]
}
```

## Adding Your Own Examples

### Method 1: Using Python

```python
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct
from openai import OpenAI

client = QdrantClient(url="http://localhost:6333")
openai_client = OpenAI(api_key="your-key")

# Generate embedding
text = "Your best practice example here"
embedding = openai_client.embeddings.create(
    input=text,
    model="text-embedding-3-small"
).data[0].embedding

# Add to collection
client.upsert(
    collection_name="skills-handbook-positive",
    points=[
        PointStruct(
            id=100,  # Use unique IDs
            vector=embedding,
            payload={
                "text": text,
                "tool": "your-tool",
                "reasoning": "Why this is a good practice"
            }
        )
    ]
)
```

### Method 2: Bulk Upload

Modify `setup_qdrant.py` to include your examples in the `POSITIVE_EXAMPLES` and `NEGATIVE_EXAMPLES` lists, then run the setup script again.

## Troubleshooting

### Plugin Not Being Called

**Issue**: Gateway runs but plugin doesn't execute
**Solution**:
1. Restart gateway after building plugins: `uv run npm run build-plugins && uv run npm run dev:node`
2. Verify config format includes `"type": "mutator"` and `"checks"` array is NOT used

### Qdrant Connection Error

**Issue**: `Error querying Qdrant collection`
**Solution**:
1. Check Qdrant is running: `curl http://localhost:6333/health`
2. Verify endpoint URL doesn't have trailing slash
3. Check collections exist: `curl http://localhost:6333/collections`

### No Results from Qdrant

**Issue**: Plugin runs but returns no examples
**Solution**:
1. Lower `scoreThreshold` (try 0.3 or 0.0 for testing)
2. Verify collections have data: `curl http://localhost:6333/collections/skills-handbook-positive`
3. Check embeddings were generated correctly during setup

### OpenAI API Errors

**Issue**: Embedding generation fails
**Solution**:
1. Verify OpenAI API key is valid
2. Check you have credits/quota available
3. Ensure `openaiApiKey` is in `credentials` section of config

## Next Steps

1. **Add your own examples** - Replace the sample data with your team's best practices
2. **Create domain-specific collections** - Different collections for different tools/domains
3. **Tune parameters** - Experiment with `topK` and `scoreThreshold` for your use case
4. **Monitor usage** - Track which examples are being retrieved most often
5. **Integrate with your app** - Use the Python SDK in your production code

## Files Reference

- `plugins/skills-handbook/handbook.ts` - Main plugin implementation
- `plugins/skills-handbook/manifest.json` - Plugin configuration schema
- `plugins/skills-handbook/setup_qdrant.py` - Collection setup script
- `plugins/skills-handbook/test_integration.py` - Integration test script
- `plugins/skills-handbook/demo.ipynb` - Interactive Jupyter notebook
- `plugins/skills-handbook/SETUP.md` - This file

## Support

For issues or questions:
1. Check the gateway logs for errors
2. Verify Qdrant collections have data
3. Test with simple queries first
4. Review the demo notebook for examples

---