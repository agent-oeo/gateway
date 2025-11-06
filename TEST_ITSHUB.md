# ITS-Hub Integration Testing Guide

## Quick Test

Run the automated test script:

```bash
node test-itshub-integration.js
```

This script will:
1. Test the direct ITS-Hub endpoint
2. Test ITS-Hub through Portkey Gateway
3. Compare the results
4. Show you if the integration is working correctly

## Prerequisites

Before running the test, make sure both services are running:

### 1. Start ITS-Hub Server (Terminal 1)

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
node test-itshub-integration.js
```

## Expected Output

If everything is working correctly, you should see:

```
████████████████████████████████████████████████████████████
  ITS-Hub + Portkey Gateway Integration Test
████████████████████████████████████████████████████████████

============================================================
TEST 1: Direct ITS-Hub Endpoint
============================================================

Request URL: http://localhost:8108/v1/chat/completions
Budget: 2
Model: gpt-4.1
Question: "what is the capital of england"

✅ SUCCESS
Status: 200

Response:
The capital of England is **London**.

============================================================
TEST 2: ITS-Hub Through Portkey Gateway
============================================================

Request URL: http://localhost:8787/v1/chat/completions
Custom Host: http://localhost:8108/v1
Plugin: custom.itsHub
Budget: 2
Model: gpt-4.1
Question: "what is the capital of england"

✅ SUCCESS
Status: 200

Response:
The capital of England is **London**.

✅ Plugin Executed:
   ID: custom.itsHub
   Budget Added: 2
   Transformed: true
   Execution Time: 0ms

============================================================
TEST 3: Comparing Results
============================================================

Direct ITS-Hub Answer:
The capital of England is **London**.

Through Portkey Answer:
The capital of England is **London**.

✅ Both endpoints returned valid responses
✅ Integration is working correctly!

============================================================
SUMMARY
============================================================

Test 1 (Direct ITS-Hub):     ✅ PASS
Test 2 (Through Portkey):    ✅ PASS

🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉
ALL TESTS PASSED! Integration is working perfectly!
🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉
```

## Troubleshooting

### Test 1 Fails (Direct ITS-Hub)
- Check if ITS-Hub is running: `curl http://localhost:8108/v1/chat/completions`
- Verify the port is 8108
- Make sure you configured ITS-Hub

### Test 2 Fails (Through Portkey)
- Check if Portkey Gateway is running: `curl http://localhost:8787/v1/chat/completions`
- Rebuild plugins: `npm run build-plugins`
- Restart Portkey Gateway

### Both Tests Fail
- Check if you have the correct OpenAI API key in `.env`
- Verify network connectivity
- Check firewall settings

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

### Through Portkey Gateway
```bash
node -e '
const http = require("http");
const config = JSON.stringify({
  provider: "openai",
  api_key: "dummy-key",
  custom_host: "http://localhost:8108/v1",
  inputMutators: [{"custom.itsHub": {budget: 2}}]
});
const data = JSON.stringify({
  model: "gpt-4.1",
  messages: [{role: "user", content: "what is the capital of england"}]
});
const req = http.request({
  hostname: "localhost",
  port: 8787,
  path: "/v1/chat/completions",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-portkey-config": config,
    "Content-Length": data.length
  }
}, res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => console.log(JSON.stringify(JSON.parse(d), null, 2)));
});
req.write(data);
req.end();
'
```

## What the Test Validates

1. ✅ ITS-Hub server is accessible and responding
2. ✅ Portkey Gateway is running and accessible
3. ✅ Plugin is correctly built and loaded
4. ✅ `custom.itsHub` plugin executes successfully
5. ✅ `budget` parameter is added to requests
6. ✅ Requests are routed to the correct ITS-Hub endpoint
7. ✅ Responses are returned correctly through Portkey
8. ✅ Hook results confirm plugin transformation

## Next Steps

Once all tests pass, you can:
- Use the integration in your applications (see `ITS_HUB_USAGE.md`)
- Modify the budget parameter to test different configurations
- Add additional Portkey features (caching, retries, load balancing, etc.)
