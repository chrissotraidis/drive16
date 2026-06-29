# Drive16 Agent Context

Drive16 keeps repo-owned agent instructions here. Validation harnesses can read
these files into an OpenCode prompt, while `corpus/` remains the RAG knowledge
base indexed by `mcp-local-rag`.

The files in `agent/skills/` are product-specific operating recipes. They do
not contain secrets, provider configuration, or model-specific credentials.
