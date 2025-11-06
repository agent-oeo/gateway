#!/usr/bin/env python3
"""
End-to-end integration test for Skills Handbook plugin.

This script tests the plugin by making requests to the Portkey Gateway
and verifying that memories are retrieved and injected into prompts.

Requirements:
    pip install requests

Usage:
    python test_integration.py --gateway-url http://localhost:8787 --provider openai --api-key <your-openai-key>
"""

import argparse
import json
import requests


def test_skills_handbook_plugin(
    gateway_url: str,
    provider: str,
    api_key: str,
    qdrant_url: str,
    qdrant_api_key: str = None,
    openai_key: str = None
):
    """
    Test the skills-handbook plugin integration.

    Args:
        gateway_url: URL of the Portkey Gateway
        provider: LLM provider to use (e.g., 'openai')
        api_key: API key for the LLM provider
        qdrant_url: Qdrant instance URL
        qdrant_api_key: Optional Qdrant API key
    """
    # Construct the chat completions endpoint
    endpoint = f"{gateway_url}/v1/chat/completions"

    # Configure the plugin
    config = {
        "strategy": {"mode": "single"},
        "targets": [{"provider": provider, "api_key": api_key}],
        "input_guardrails": [
            {
                "id": "skills-handbook-memory-retrieval",
                "type": "mutator",
                "skills-handbook.handbook": {
                    "credentials": {
                        "endpoint": qdrant_url,
                        "apiKey": qdrant_api_key or "",
                        "openaiApiKey": openai_key
                    },
                    "positiveCollectionName": "skills-handbook-positive",
                    "negativeCollectionName": "skills-handbook-negative",
                    "topK": 3,
                    "scoreThreshold": 0.5,  # Lower threshold since we're using real embeddings now
                    "includePositive": True,
                    "includeNegative": True,
                    "timeout": 10000
                }
            }
        ]
    }

    # Test request
    test_message = "How should I handle API authentication in my application?"

    request_body = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "user",
                "content": test_message
            }
        ],
        "max_tokens": 150
    }

    headers = {
        "Content-Type": "application/json",
        "x-portkey-config": json.dumps(config)
    }

    print("="*80)
    print("Testing Skills Handbook Plugin Integration")
    print("="*80)
    print(f"\nGateway URL: {gateway_url}")
    print(f"Provider: {provider}")
    print(f"Qdrant URL: {qdrant_url}")
    print(f"\nTest Query: {test_message}")
    print("\n" + "="*80)

    try:
        print("\nSending request to gateway...")
        response = requests.post(
            endpoint,
            headers=headers,
            json=request_body,
            timeout=30
        )

        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()

            print("\n✅ Request successful!")
            print("\n" + "="*80)
            print("Response:")
            print("="*80)

            if "choices" in result and len(result["choices"]) > 0:
                assistant_message = result["choices"][0]["message"]["content"]
                print(f"\nAssistant: {assistant_message}")

            print("\n" + "="*80)
            print("Plugin Metadata (if available):")
            print("="*80)

            # Check for plugin metadata in headers or response
            plugin_data = response.headers.get("x-portkey-metadata")
            if plugin_data:
                print(json.dumps(json.loads(plugin_data), indent=2))
            else:
                print("No plugin metadata in response headers")

            # The plugin should have modified the request to include memories
            # In a real setup with actual embeddings, you'd see relevant examples
            print("\n" + "="*80)
            print("Expected Behavior:")
            print("="*80)
            print("The plugin should have:")
            print("1. Intercepted the request")
            print("2. Queried Qdrant for positive and negative examples")
            print("3. Added <positive_examples> and <negative_examples> to the system message")
            print("4. Sent the enhanced prompt to the LLM")
            print("\nNote: With dummy vectors, results are random. For real use,")
            print("you'd use actual embeddings (e.g., from OpenAI or sentence-transformers)")

        else:
            print(f"\n❌ Request failed!")
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")

    except requests.exceptions.ConnectionError:
        print("\n❌ Connection Error!")
        print(f"Could not connect to gateway at {gateway_url}")
        print("\nMake sure the gateway is running:")
        print("  npm run dev:node")
        print("  or")
        print("  npm run dev")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


def test_with_curl_example(gateway_url: str, provider: str, qdrant_url: str):
    """Print a curl command example for manual testing"""
    config = {
        "strategy": {"mode": "single"},
        "targets": [{"provider": provider, "api_key": "YOUR_OPENAI_API_KEY"}],
        "input_guardrails": [
            {
                "id": "skills-handbook-memory-retrieval",
                "type": "mutator",
                "skills-handbook.handbook": {
                    "credentials": {
                        "endpoint": qdrant_url,
                        "apiKey": ""
                    },
                    "positiveCollectionName": "skills-handbook-positive",
                    "negativeCollectionName": "skills-handbook-negative",
                    "topK": 3,
                    "scoreThreshold": 0.0,
                    "includePositive": True,
                    "includeNegative": True
                }
            }
        ]
    }

    config_json = json.dumps(config)

    curl_command = f"""
# Test Skills Handbook Plugin with curl

curl -X POST "{gateway_url}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H 'x-portkey-config: {config_json}' \\
  -d '{{
    "model": "gpt-3.5-turbo",
    "messages": [
      {{
        "role": "user",
        "content": "How should I handle API authentication?"
      }}
    ],
    "max_tokens": 150
  }}'
"""

    print("\n" + "="*80)
    print("cURL Example for Manual Testing:")
    print("="*80)
    print(curl_command)


def main():
    parser = argparse.ArgumentParser(
        description="Test Skills Handbook plugin integration"
    )
    parser.add_argument(
        "--gateway-url",
        default="http://localhost:8787",
        help="Portkey Gateway URL (default: http://localhost:8787)"
    )
    parser.add_argument(
        "--provider",
        default="openai",
        help="LLM provider (default: openai)"
    )
    parser.add_argument(
        "--api-key",
        required=True,
        help="API key for the LLM provider"
    )
    parser.add_argument(
        "--qdrant-url",
        default="http://localhost:6333",
        help="Qdrant instance URL (default: http://localhost:6333)"
    )
    parser.add_argument(
        "--qdrant-api-key",
        default=None,
        help="Qdrant API key (optional)"
    )
    parser.add_argument(
        "--openai-key",
        required=True,
        help="OpenAI API key for generating embeddings"
    )
    parser.add_argument(
        "--curl-only",
        action="store_true",
        help="Only print curl example without running test"
    )

    args = parser.parse_args()

    if args.curl_only:
        test_with_curl_example(args.gateway_url, args.provider, args.qdrant_url)
    else:
        test_skills_handbook_plugin(
            args.gateway_url,
            args.provider,
            args.api_key,
            args.qdrant_url,
            args.qdrant_api_key,
            args.openai_key
        )
        print("\n")
        test_with_curl_example(args.gateway_url, args.provider, args.qdrant_url)


if __name__ == "__main__":
    main()
