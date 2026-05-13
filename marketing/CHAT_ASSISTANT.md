# AI powered chat assistant for docs

Here is a production-ready blueprint to build a scalable RAG (Retrieval-Augmented Generation) chat assistant on AWS, leaning into your experience with external vector databases or AWS native options.

## Architecture Blueprint

```bash
[ Frontend: Next.js/React ] 
       │ (WebSocket / SSE streaming)
       ▼
[ API Gateway / ALB ] ──► [ AWS Lambda / ECS Fargate ]
                              │ (Orchestration with LangChain/LlamaIndex)
                              ├──► [ AWS Bedrock ] (Embeddings & LLM Generation)
                              └──► [ Vector DB: Upstash / Qdrant / AWS OpenSearch ]
```

## Step 1: The Orchestration Layer (Compute)

You need an environment to handle incoming user questions, fetch embeddings, query the vector DB, and stream responses back.

- **Option A: AWS Lambda (Serverless)**
  - **When to use:** Low-to-medium traffic, or to minimize idle costs.
  - **Implementation:** Wrap your API logic in a Node.js or Python Lambda. Ensure you enable **Lambda Function URLs** or integrate with **API Gateway v2** to support HTTP streaming (Server-Sent Events) for a snappy ChatGPT-style typewriter effect.
- **Option B: AWS ECS Fargate (Containerized)**
  - **When to use:** High traffic, or if your pipeline requires heavy long-running processes that exceed Lambda's 15-minute execution limit.
  - **Implementation:** Package your app using Docker and run it on a serverless container cluster.

## Step 2: The Vector Database Integration

Since you have experience with Upstash and Qdrant, you can either keep them or migrate natively into the AWS ecosystem:

- **Stick with Upstash / Qdrant:** You can absolutely connect your AWS Lambda or ECS containers to your external Upstash or Qdrant endpoints via standard HTTPS REST/gRPC calls. Just store your API keys securely in **AWS Secrets Manager**.
- **Go Native with Amazon OpenSearch Serverless (Vector Engine):** If you must keep all data strictly inside AWS for compliance, use OpenSearch Serverless. It supports k-NN (k-nearest neighbors) search and automatically scales compute up and down without managing clusters.

## Step 3: LLM & Embedding Pipeline (Amazon Bedrock)

Instead of managing separate third-party API keys (like OpenAI), use **Amazon Bedrock**, which provides serverless access to top-tier foundation models via unified AWS APIs.

1. **Generating Embeddings:** When documentation updates or a user asks a question, pass the text to Bedrock's `amazon.titan-embed-text-v2` or `cohere.embed-english-v3` models to generate vectors.
2. **Generating Responses:** Pass your compiled prompt (retrieved text context + user query) to models like **Anthropic Claude 3.5 Sonnet** (highly recommended for technical docs and coding) or **Meta Llama 3** via the Bedrock Converse API.

## Step 4: Step-by-Step Code Flow (Python Example)

Here is how your AWS Lambda or ECS orchestration code would handle a user question using the `boto3` SDK:

```python
import os
import boto3
from qdrant_client import QdrantClient

# Initialize AWS Bedrock and Qdrant Client
bedrock_runtime = boto3.client(service_name="bedrock-runtime", region_name="us-east-1")
qdrant_client = QdrantClient(url=os.environ["QDRANT_URL"], api_key=os.environ["QDRANT_API_KEY"])

def handler(event, context):
    user_query = event["query"]
    
    # 1. Generate embedding for user query via Bedrock
    embed_response = bedrock_runtime.invoke_model(
        modelId="amazon.titan-embed-text-v2",
        contentType="application/json",
        accept="application/json",
        body=f'{{"inputText": "{user_query}"}}'
    )
    # Parse vector floats from embed_response...
    query_vector = parse_embedding(embed_response) 
    
    # 2. Query your Vector DB (e.g., Qdrant) for context
    search_results = qdrant_client.search(
        collection_name="tech_docs",
        query_vector=query_vector,
        limit=3
    )
    context_text = "\n".join([hit.payload["text"] for hit in search_results])
    
    # 3. Stream a response from Anthropic Claude via Bedrock
    prompt = f"Answer based strictly on this context:\n{context_text}\n\nUser Question: {user_query}"
    
    response_stream = bedrock_runtime.invoke_model_with_response_stream(
        modelId="anthropic.claude-3-5-sonnet-20240620-v1:0",
        body=f'{{"anthropic_version": "bedrock-2023-05-31", "max_tokens": 1000, "messages": [{{"role": "user", "content": "{prompt}"}}]}}'
    )
    
    # Iterate and yield tokens back to frontend via Server-Sent Events (SSE)
    for event in response_stream.get("body"):
        # Parse chunk and stream to user...
        pass
```

## Step 5: Document Syncing Pipeline (The "Torqbit" Clone)

To automatically update your vector store when docs change, build an event-driven ingestion pipeline:

1. Set up an **AWS S3 bucket** or a webhook from your GitHub repo.
2. Whenever a markdown file is uploaded or pushed, trigger an **S3/GitHub Webhook Event** to an **AWS Lambda chunking function**.
3. The function splits the markdown, calls the Bedrock embedding model, and upserts the payloads into your vector database.

Do you want to see how to configure **Amazon OpenSearch Serverless** as the vector database using Terraform, or should we write a full **TypeScript/Next.js frontend snippet** to stream the response from this AWS backend?