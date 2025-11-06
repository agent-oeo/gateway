# Skills Handbook Plugin - Quick Start Guide

Get the Skills Handbook plugin up and running in 5 minutes!

## Step-by-Step Guide

### 1. Start Qdrant (Local)

Using Docker:

```bash
docker run -p 6333:6333 qdrant/qdrant
```

This starts Qdrant on `http://localhost:6333` with no authentication.

> **Note**: For production, use Qdrant Cloud or secure your local instance.

### 2. Install Python Dependencies

```bash
pip install qdrant-client requests
```

### 3. Set Up Qdrant with Sample Data

```bash
cd /Users/shiv/workspace/gateway
python plugins/skills-handbook/setup_qdrant.py --url http://localhost:6333
```

Expected output:
```
Connected to Qdrant at http://localhost:6333

Creating collection: skills-handbook-positive
  Created skills-handbook-positive

Creating collection: skills-handbook-negative
  Created skills-handbook-negative

Adding 8 positive examples...
  Added 8 points to skills-handbook-positive

Adding 8 negative examples...
  Added 8 points to skills-handbook-negative

============================================================
Setup complete! Collections created:
  - skills-handbook-positive: 8 points
  - skills-handbook-negative: 8 points
============================================================
```

### 4. Start the Gateway

In a new terminal:

```bash
cd /Users/shiv/workspace/gateway
npm run dev:node
```

The gateway will start on `http://localhost:8787`

### 5. Test with Python

```bash
python plugins/skills-handbook/test_integration.py \
  --gateway-url http://localhost:8787 \
  --provider openai \
  --api-key sk-your-openai-api-key \
  --qdrant-url http://localhost:6333
```

### 6. Test with curl

Get the curl command:

```bash
python plugins/skills-handbook/test_integration.py --curl-only
```

Then run the printed curl command with your API key.

## What to Expect

When you make a request like:

```
"How should I handle API authentication?"
```

The plugin will:

1. ✅ Intercept the request
2. ✅ Query Qdrant for relevant positive examples (e.g., "Always validate authentication tokens")
3. ✅ Query Qdrant for relevant negative examples (e.g., "Never skip authentication checks")
4. ✅ Inject these examples into the system message
5. ✅ Send the enhanced prompt to the LLM

The LLM receives context like:

```xml
<positive_examples>
These are examples of correct usage:
1. [Tool: api] Always validate authentication tokens before processing requests
   Reasoning: Security best practice to prevent unauthorized access
2. [Tool: security] Use environment variables to store API keys, never hardcode them
   Reasoning: Security best practice to prevent credential leaks
...
</positive_examples>

<negative_examples>
These are examples of incorrect usage to avoid:
1. [Tool: api] Never skip authentication checks assuming requests are safe
   Reasoning: Opens security vulnerabilities and allows unauthorized access
2. [Tool: security] Never expose API keys in client-side code or version control
   Reasoning: Major security risk that can lead to unauthorized access
...
</negative_examples>

User: How should I handle API authentication?
```

## Complete Example

Here's a complete working example using curl:

```bash
curl -X POST "http://localhost:8787/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "x-portkey-api-key: sk-your-openai-api-key" \
  -H "x-portkey-provider: openai" \
  -H 'x-portkey-config: {"strategy":{"mode":"single"},"targets":[{"provider":"openai"}],"input_guardrails":[{"id":"skills-handbook-handbook","credentials":{"endpoint":"http://localhost:6333","apiKey":""},"topK":3,"scoreThreshold":0.0}]}' \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "How should I handle API authentication?"}
    ],
    "max_tokens": 200
  }'
```

## Verification

To verify the plugin is working, check the gateway logs. You should see:

```
Plugin skills-handbook-handbook executed
Retrieved X positive examples and Y negative examples
```

## Next Steps

1. **Use Real Embeddings**: The setup script uses dummy vectors. For production, use actual embeddings from models like `sentence-transformers` or OpenAI's embedding API.

2. **Add Your Own Memories**: Populate Qdrant with domain-specific positive and negative examples for your use case.

3. **Tune Parameters**: Adjust `topK` and `scoreThreshold` to control how many examples are retrieved.

4. **Deploy to Production**: Use Qdrant Cloud and secure your credentials.

## Troubleshooting

### Qdrant not connecting?

```bash
# Check if Qdrant is running
curl http://localhost:6333

# Should return: {"title":"qdrant - vector search engine","version":"..."}
```

### Gateway not starting?

```bash
# Install dependencies
npm install

# Rebuild plugins
npm run build-plugins

# Start with verbose logging
npm run dev:node
```

### No memories being retrieved?

The setup script uses dummy random vectors, so matches are random. For semantic matching:

1. Use real embeddings in production
2. Set `scoreThreshold: 0.0` for testing with dummy vectors

### Plugin not found?

```bash
# Verify plugin is enabled
cat conf.json | grep skills-handbook

# Should show: "skills-handbook"

# Rebuild plugins
npm run build-plugins
```

## Support

For issues or questions:
- Check the full [README.md](./README.md)
- Review the [test file](./handbook.test.ts) for examples
- Check Portkey documentation at https://portkey.ai/docs
