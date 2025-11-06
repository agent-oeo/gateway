#!/usr/bin/env python3
"""
Setup script for Qdrant with sample Skills Handbook data.

This script creates two collections (positive and negative examples) and
populates them with sample memories about using APIs correctly.

Requirements:
    pip install qdrant-client openai

Usage:
    python setup_qdrant.py --url http://localhost:6333 --openai-key <your-openai-key>

For Qdrant Cloud:
    python setup_qdrant.py --url https://your-cluster.qdrant.io --qdrant-api-key <your-api-key> --openai-key <your-openai-key>

For local Qdrant (no auth):
    python setup_qdrant.py --url http://localhost:6333 --openai-key <your-openai-key>
"""

import argparse
import os
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from openai import OpenAI


# Sample positive examples - good practices
POSITIVE_EXAMPLES = [
    {
        "id": 1,
        "text": "Always validate authentication tokens before processing requests",
        "tool": "api",
        "reasoning": "Security best practice to prevent unauthorized access"
    },
    {
        "id": 2,
        "text": "Include proper error handling with try-catch blocks around API calls",
        "tool": "api",
        "reasoning": "Prevents application crashes and provides better user feedback"
    },
    {
        "id": 3,
        "text": "Use pagination when fetching large datasets from the API",
        "tool": "search",
        "reasoning": "Improves performance and prevents memory issues"
    },
    {
        "id": 4,
        "text": "Always set timeout values for HTTP requests to prevent hanging",
        "tool": "api",
        "reasoning": "Prevents indefinite waiting and improves reliability"
    },
    {
        "id": 5,
        "text": "Validate input parameters before making API calls",
        "tool": "api",
        "reasoning": "Catches errors early and provides better error messages"
    },
    {
        "id": 6,
        "text": "Use environment variables to store API keys, never hardcode them",
        "tool": "security",
        "reasoning": "Security best practice to prevent credential leaks"
    },
    {
        "id": 7,
        "text": "Implement rate limiting to respect API quotas",
        "tool": "api",
        "reasoning": "Prevents hitting rate limits and service disruption"
    },
    {
        "id": 8,
        "text": "Log API requests and responses for debugging purposes",
        "tool": "debugging",
        "reasoning": "Helps troubleshoot issues and monitor system behavior"
    },
]

# Sample negative examples - bad practices to avoid
NEGATIVE_EXAMPLES = [
    {
        "id": 1,
        "text": "Never skip authentication checks assuming requests are safe",
        "tool": "api",
        "reasoning": "Opens security vulnerabilities and allows unauthorized access"
    },
    {
        "id": 2,
        "text": "Don't ignore error responses from the API",
        "tool": "api",
        "reasoning": "Can lead to silent failures and data inconsistencies"
    },
    {
        "id": 3,
        "text": "Avoid fetching all records at once without pagination",
        "tool": "search",
        "reasoning": "Causes performance issues and can crash the application"
    },
    {
        "id": 4,
        "text": "Don't use infinite timeouts or no timeout at all",
        "tool": "api",
        "reasoning": "Can cause requests to hang indefinitely"
    },
    {
        "id": 5,
        "text": "Never expose API keys in client-side code or version control",
        "tool": "security",
        "reasoning": "Major security risk that can lead to unauthorized access"
    },
    {
        "id": 6,
        "text": "Don't make API calls in tight loops without rate limiting",
        "tool": "api",
        "reasoning": "Will hit rate limits and get blocked by the API"
    },
    {
        "id": 7,
        "text": "Avoid using HTTP instead of HTTPS for API calls",
        "tool": "security",
        "reasoning": "Data transmitted in plain text can be intercepted"
    },
    {
        "id": 8,
        "text": "Don't trust user input without sanitization in API requests",
        "tool": "security",
        "reasoning": "Opens the door to injection attacks and security vulnerabilities"
    },
]


def get_openai_embedding(text: str, openai_client: OpenAI, model: str = "text-embedding-3-small"):
    """
    Get embedding vector from OpenAI API.

    Args:
        text: Text to embed
        openai_client: OpenAI client instance
        model: Embedding model to use (default: text-embedding-3-small with 1536 dimensions)

    Returns:
        List of floats representing the embedding vector
    """
    response = openai_client.embeddings.create(
        input=text,
        model=model
    )
    return response.data[0].embedding


def setup_qdrant(url: str, qdrant_api_key: str = None, openai_api_key: str = None):
    """
    Set up Qdrant collections with sample data using OpenAI embeddings.

    Args:
        url: Qdrant instance URL
        qdrant_api_key: Optional API key for Qdrant authentication
        openai_api_key: OpenAI API key for generating embeddings
    """
    # Initialize Qdrant client
    if qdrant_api_key:
        client = QdrantClient(url=url, api_key=qdrant_api_key)
    else:
        client = QdrantClient(url=url)

    # Initialize OpenAI client
    if not openai_api_key:
        raise ValueError("OpenAI API key is required to generate embeddings")

    openai_client = OpenAI(api_key=openai_api_key)

    print(f"Connected to Qdrant at {url}")
    print(f"Using OpenAI embeddings with text-embedding-3-small model")

    # Collection names
    positive_collection = "skills-handbook-positive"
    negative_collection = "skills-handbook-negative"

    vector_size = 1536  # text-embedding-3-small dimension

    # Create positive collection
    print(f"\nCreating collection: {positive_collection}")
    try:
        client.delete_collection(positive_collection)
        print(f"  Deleted existing {positive_collection}")
    except:
        pass

    client.create_collection(
        collection_name=positive_collection,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )
    print(f"  Created {positive_collection}")

    # Create negative collection
    print(f"\nCreating collection: {negative_collection}")
    try:
        client.delete_collection(negative_collection)
        print(f"  Deleted existing {negative_collection}")
    except:
        pass

    client.create_collection(
        collection_name=negative_collection,
        vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
    )
    print(f"  Created {negative_collection}")

    # Add positive examples
    print(f"\nAdding {len(POSITIVE_EXAMPLES)} positive examples...")
    positive_points = []
    for example in POSITIVE_EXAMPLES:
        print(f"  Generating embedding for: {example['text'][:50]}...")
        vector = get_openai_embedding(example["text"], openai_client)
        positive_points.append(
            PointStruct(
                id=example["id"],
                vector=vector,
                payload={
                    "text": example["text"],
                    "tool": example["tool"],
                    "reasoning": example["reasoning"],
                    "example": example["text"],  # Duplicate for different access patterns
                }
            )
        )

    client.upsert(
        collection_name=positive_collection,
        points=positive_points
    )
    print(f"  Added {len(positive_points)} points to {positive_collection}")

    # Add negative examples
    print(f"\nAdding {len(NEGATIVE_EXAMPLES)} negative examples...")
    negative_points = []
    for example in NEGATIVE_EXAMPLES:
        print(f"  Generating embedding for: {example['text'][:50]}...")
        vector = get_openai_embedding(example["text"], openai_client)
        negative_points.append(
            PointStruct(
                id=example["id"],
                vector=vector,
                payload={
                    "text": example["text"],
                    "tool": example["tool"],
                    "reasoning": example["reasoning"],
                    "example": example["text"],  # Duplicate for different access patterns
                }
            )
        )

    client.upsert(
        collection_name=negative_collection,
        points=negative_points
    )
    print(f"  Added {len(negative_points)} points to {negative_collection}")

    # Verify
    print("\n" + "="*60)
    print("Setup complete! Collections created:")
    print(f"  - {positive_collection}: {client.count(positive_collection).count} points")
    print(f"  - {negative_collection}: {client.count(negative_collection).count} points")
    print("="*60)

    # Test a query
    print("\nTesting query: 'How do I handle API authentication?'")
    test_query_vector = get_openai_embedding("How do I handle API authentication?", openai_client)
    results = client.query_points(
        collection_name=positive_collection,
        query=test_query_vector,
        limit=3,
    )

    if results.points:
        print(f"\nFound {len(results.points)} results:")
        for point in results.points:
            print(f"  - [{point.score:.3f}] {point.payload.get('text', 'N/A')}")

    print("\n✅ Qdrant setup completed successfully!")
    print(f"\nNext steps:")
    print(f"1. Update conf.json with your Qdrant credentials")
    print(f"2. Run the test script: python plugins/skills-handbook/test_integration.py")


def main():
    parser = argparse.ArgumentParser(
        description="Setup Qdrant with Skills Handbook sample data using OpenAI embeddings"
    )
    parser.add_argument(
        "--url",
        default="http://localhost:6333",
        help="Qdrant instance URL (default: http://localhost:6333)"
    )
    parser.add_argument(
        "--qdrant-api-key",
        default=None,
        help="Qdrant API key (optional, for Qdrant Cloud)"
    )
    parser.add_argument(
        "--openai-key",
        default=None,
        help="OpenAI API key (required for embeddings, or set OPENAI_API_KEY env var)"
    )

    args = parser.parse_args()

    # Get OpenAI API key from args or environment variable
    openai_key = args.openai_key or os.getenv("OPENAI_API_KEY")

    if not openai_key:
        print("❌ Error: OpenAI API key is required")
        print("Either provide --openai-key argument or set OPENAI_API_KEY environment variable")
        exit(1)

    try:
        setup_qdrant(args.url, args.qdrant_api_key, openai_key)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("\nMake sure:")
        print("1. Qdrant is running (for local: docker run -p 6333:6333 qdrant/qdrant)")
        print("2. Required packages are installed (pip install qdrant-client openai)")
        print("3. The URLs and API keys are correct")
        exit(1)


if __name__ == "__main__":
    main()
