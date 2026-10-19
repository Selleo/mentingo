# Embedding tracing

Global search opts out of AI SDK telemetry directly in its shared query/indexing embedding call. `telemetry: { isEnabled: false }` prevents the SDK from dispatching telemetry callbacks, so these calls create neither operation nor provider embedding observations, including on failure. Provider errors still follow the existing application error/fallback paths. AI Mentor/RAG and document-ingestion embeddings retain their existing telemetry for conversation and retrieval diagnostics.

The standard Langfuse processor is unchanged. There is no custom processor, export filter, sampling setting or post-creation span suppression. Model generations, RAG workflow observations, product AI Judge grading and MCP tools retain their existing instrumentation. Historical traces and remote Langfuse evaluator settings are unchanged.

Focused tests run the real AI SDK with a fake embedding provider and globally registered telemetry callbacks. They verify global-search embeddings return results and propagate failures without dispatching telemetry, while Mentor/RAG embeddings continue dispatching success and failure callbacks. An enabled control call reaches the same integration. No providers or Langfuse Cloud are contacted.
