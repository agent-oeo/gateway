"""
Example: Using Portkey Gateway with OpenAI Python SDK

This is the recommended way - just point the OpenAI client to Portkey's URL
"""

from openai import OpenAI
import json
import os

# Create OpenAI client pointing to Portkey Gateway
client = OpenAI(
    base_url="http://localhost:8787/v1",  # Portkey gateway URL
    api_key="dummy-key"  # Placeholder, not used when routing to ITS-Hub
)


# Example 2: Use ITS-Hub through Portkey
def example_itshub():
    """Route to ITS-Hub (localhost:8108) through Portkey"""
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "user", "content": "What is the capital of England?"}
        ],
        extra_headers={
            "x-portkey-config": json.dumps({
                "provider": "openai",
                "api_key": "dummy-key",
                "custom_host": "http://localhost:8108/v1",
                "inputMutators": [{
                    "langfuse.itsHub": {
                        "budget": 2
                    }
                }]
            })
        }
    )

    print("ITS-Hub Response:")
    print(response.choices[0].message.content)
    print()

    # Check if hook_results are in the response (Portkey adds this)
    if hasattr(response, 'hook_results'):
        print("Plugin executed:", response.hook_results)


if __name__ == "__main__":
    print("=" * 60)
    print("Portkey Gateway - Python Examples")
    print("=" * 60)
    print()

    # Run ITS-Hub example (assuming ITS-Hub is running)
    print("Example: Calling ITS-Hub through Portkey")
    print("-" * 60)
    example_itshub()

    # Uncomment to test direct OpenAI
    # print("\nExample: Calling OpenAI directly through Portkey")
    # print("-" * 60)
    # example_openai_direct()
