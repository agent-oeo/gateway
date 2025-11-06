# ITS-Hub Integration Testing Guide

## Quick Test

Run the Python examples to test the integration:

```bash
# Activate virtual environment
source .venv/bin/activate

# Run basic example
python examples/python_portkey_basic.py

# Run requests library example (includes retry and streaming tests)
python examples/python_portkey_requests.py
```

These examples will:
1. Test ITS-Hub through Portkey Gateway
2. Show plugin execution details
3. Demonstrate different features (basic, retry, streaming)

## Prerequisites

Before running the test, make sure both services are running:

### 1. Start ITS-Hub Server (Terminal 1)

Install its-hub

```bash
# Install its-hub
pip install its-hub
```

```bash
# From your ITS-Hub directory
uv run its-iaas --host 0.0.0.0 --port 8108
```

Then configure it:
```bash
# In another terminal, configure ITS-Hub
source .env
curl -X POST http://localhost:8108/configure \
    -H "Content-Type: application/json" \
    -d '{
        "provider": "litellm",
        "endpoint": "auto",
        "api_key": "'"$OPENAI_API_KEY"'",
        "model": "gpt-4.1-mini",
        "alg": "best-of-n",
        "rm_name": "llm-judge",
        "judge_model": "gpt-4.1-mini",
        "judge_base_url": "auto",
        "judge_mode": "groupwise",
        "judge_criterion": "multi_step_tool_judge",
        "judge_api_key": "'"$OPENAI_API_KEY"'",
        "judge_temperature": 0.7,
        "judge_max_tokens": 2048
    }'
```

### 2. Start Portkey Gateway (Terminal 2)

```bash
# From the gateway directory
npm run dev:node
```

Wait for the message:
```
🚀 Your AI Gateway is running at:
   http://localhost:8787
```

### 3. Run the Test (Terminal 3)

```bash
# Activate virtual environment
source .venv/bin/activate

# Run the example
python examples/python_portkey_basic.py
```

## Expected Output

If everything is working correctly, you should see:

```
============================================================
Portkey Gateway - Python Examples
============================================================

Example: Calling ITS-Hub through Portkey
------------------------------------------------------------
ITS-Hub Response:
The capital of England is **London**.

Plugin executed: {
  'before_request_hooks': [{
    'verdict': True,
    'id': 'input_guardrail_xxx',
    'transformed': True,
    'checks': [{
      'data': {
        'budget': 2,
        'itsHubParametersAdded': True
      },
      'verdict': True,
      'id': 'langfuse.itsHub',
      'execution_time': 1,
      'transformed': True,
      'created_at': '2025-11-06T22:43:16.815Z',
      'log': None,
      'fail_on_error': False
    }],
    'feedback': None,
    'execution_time': 1,
    'async': False,
    'type': 'mutator',
    'created_at': '2025-11-06T22:43:16.815Z',
    'deny': False
  }],
  'after_request_hooks': []
}
```

## Troubleshooting

### Direct ITS-Hub Fails
- Check if ITS-Hub is running: `curl http://localhost:8108/v1/chat/completions`
- Verify the port is 8108
- Make sure you configured ITS-Hub with the `/configure` endpoint

### Through Portkey Fails
- Check if Portkey Gateway is running: `curl http://localhost:8787/v1/chat/completions`
- Ensure the `langfuse` plugin is enabled in `conf.json`
- Rebuild plugins: `npm run build-plugins`
- Restart Portkey Gateway: `npm run dev:node`

### Both Tests Fail
- Check if you have the correct OpenAI API key in `.env`
- Verify network connectivity
- Check firewall settings
- Ensure Python virtual environment is activated: `source .venv/bin/activate`

## Manual Testing

If you prefer to test manually:

### Direct ITS-Hub Call
```bash
curl -X POST http://localhost:8108/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4.1",
    "messages": [{"role": "user", "content": "what is the capital of england"}],
    "budget": 2
  }' | jq .
```

### Through Portkey Gateway (Python)
```bash
source .venv/bin/activate
python -c '
from openai import OpenAI
import json

client = OpenAI(
    base_url="http://localhost:8787/v1",
    api_key="dummy-key"
)

response = client.chat.completions.create(
    model="gpt-4.1",
    messages=[{"role": "user", "content": "what is the capital of england"}],
    extra_headers={
        "x-portkey-config": json.dumps({
            "provider": "openai",
            "api_key": "dummy-key",
            "custom_host": "http://localhost:8108/v1",
            "inputMutators": [{"langfuse.itsHub": {"budget": 2}}]
        })
    }
)

print(response.choices[0].message.content)
'
```

## What the Test Validates

1. ✅ ITS-Hub server is accessible and responding
2. ✅ Portkey Gateway is running and accessible
3. ✅ Plugin is correctly built and loaded
4. ✅ `langfuse.itsHub` plugin executes successfully
5. ✅ `budget` parameter is added to requests
6. ✅ Requests are routed to the correct ITS-Hub endpoint
7. ✅ Responses are returned correctly through Portkey
8. ✅ Hook results confirm plugin transformation

## Next Steps

Once all tests pass, you can:
- Use the integration in your applications (see `ITS_HUB_USAGE.md`)
- Modify the budget parameter to test different configurations
- Add additional Portkey features (caching, retries, load balancing, etc.)
