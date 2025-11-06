"""
Example: Using Portkey Gateway with Python requests library

This is a lower-level approach if you don't want to use OpenAI SDK
"""

import requests
import json


def call_portkey_itshub():
    """Call ITS-Hub through Portkey using requests library"""

    url = "http://localhost:8787/v1/chat/completions"

    # Configuration goes in the header
    headers = {
        "Content-Type": "application/json",
        "x-portkey-config": json.dumps({
            "provider": "openai",
            "api_key": "dummy-key",
            "custom_host": "http://localhost:8108/v1",
            "inputMutators": [{
                "custom.itsHub": {
                    "budget": 2
                }
            }]
        })
    }

    # Request body
    data = {
        "model": "gpt-4.1",
        "messages": [
            {"role": "user", "content": "What is the capital of England?"}
        ]
    }

    # Make the request
    response = requests.post(url, headers=headers, json=data)

    # Parse response
    if response.status_code == 200:
        result = response.json()
        print("Success!")
        print(f"Response: {result['choices'][0]['message']['content']}")
        print()

        # Check plugin execution
        if 'hook_results' in result:
            hooks = result['hook_results']['before_request_hooks']
            if hooks:
                plugin_check = hooks[0]['checks'][0]
                print("Plugin Info:")
                print(f"  ID: {plugin_check['id']}")
                print(f"  Budget: {plugin_check['data']['budget']}")
                print(f"  Transformed: {plugin_check['transformed']}")
    else:
        print(f"Error: {response.status_code}")
        print(response.text)


def call_portkey_with_retry():
    """Example with Portkey's retry feature"""

    url = "http://localhost:8787/v1/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "x-portkey-config": json.dumps({
            "provider": "openai",
            "api_key": "dummy-key",
            "custom_host": "http://localhost:8108/v1",
            "retry": {
                "attempts": 3  # Retry up to 3 times on failure
            },
            "inputMutators": [{
                "custom.itsHub": {
                    "budget": 2
                }
            }]
        })
    }

    data = {
        "model": "gpt-4.1",
        "messages": [
            {"role": "user", "content": "Explain quantum computing briefly"}
        ]
    }

    response = requests.post(url, headers=headers, json=data)
    result = response.json()

    print("Response with Retry Config:")
    print(result['choices'][0]['message']['content'])


def call_portkey_streaming():
    """Example with streaming response"""

    url = "http://localhost:8787/v1/chat/completions"

    headers = {
        "Content-Type": "application/json",
        "x-portkey-config": json.dumps({
            "provider": "openai",
            "api_key": "dummy-key",
            "custom_host": "http://localhost:8108/v1",
            "inputMutators": [{
                "custom.itsHub": {
                    "budget": 2
                }
            }]
        })
    }

    data = {
        "model": "gpt-4.1",
        "messages": [
            {"role": "user", "content": "Count from 1 to 5"}
        ],
        "stream": True  # Enable streaming
    }

    print("Streaming response:")
    response = requests.post(url, headers=headers, json=data, stream=True)

    for line in response.iter_lines():
        if line:
            line_str = line.decode('utf-8')
            if line_str.startswith('data: '):
                data_str = line_str[6:]  # Remove 'data: ' prefix
                if data_str.strip() != '[DONE]':
                    try:
                        chunk = json.loads(data_str)
                        if chunk['choices'][0]['delta'].get('content'):
                            print(chunk['choices'][0]['delta']['content'], end='', flush=True)
                    except json.JSONDecodeError:
                        pass
    print("\n")



if __name__ == "__main__":
    print("=" * 60)
    print("Portkey Gateway - Requests Library Examples")
    print("=" * 60)
    print()

    print("Example 1: Basic Call")
    print("-" * 60)
    call_portkey_itshub()

    # Uncomment to test other features
    print("\nExample 3: With Retry")
    print("-" * 60)
    call_portkey_with_retry()

    print("\nExample 4: Streaming")
    print("-" * 60)
    call_portkey_streaming()
