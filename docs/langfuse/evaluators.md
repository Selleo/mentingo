# LLM-as-a-judge evaluators

This guide outlines the evaluation prompts used in Langfuse for Mentingo. Each section mirrors the deployment guide structure so you can skim quickly, copy the code blocks, and understand exactly how and why to use them.

---

## **LLM-as-a-judge - Quality**

### **1.1 Purpose**

1.  Rates completeness, correctness, clarity, and helpfulness of any generation.
2.  Enforces a 0–1 scoring scale with clear guidance for intermediate scores.
3.  Flags partial gaps (0.5–0.7) and serious issues (≤0.4) so reviewers can triage quickly.

### **1.2 Prompt Template**

```
Evaluate the overall quality of the generation in response to the user’s input.

Definition:
Overall quality reflects how *good* the answer is as a whole — considering factual correctness, completeness, clarity, coherence, and helpfulness.
You should consider:
- **Correctness:** Are statements factually accurate or logically sound?
- **Completeness:** Does the answer fully address the user’s request?
- **Clarity:** Is the explanation easy to follow and well-structured?
- **Helpfulness:** Is the tone appropriate and the information genuinely useful to the user’s intent?

You are **not** judging style preferences, length, or formatting unless they affect clarity or usefulness.

Scoring:
- **Score = 1.0** → Excellent. Fully correct, complete, clear, and helpful.
- **Score = 0.0** → Very poor. Incorrect, incomplete, or incoherent answer that fails to help the user.
- **Intermediate (0–1):** Partially correct or partially helpful.
  - *0.8–0.9*: Strong answer, only minor issues.
  - *0.5–0.7*: Decent answer but missing important detail or mildly confusing.
  - *0.2–0.4*: Low quality, noticeable factual or logical issues.
  - *0.0–0.1*: Useless or misleading.

Examples:

**Example (Score: 1.0)**
Input: How does dropout prevent overfitting in neural networks?
Generation: Dropout randomly disables a fraction of neurons during training, preventing them from co-adapting too strongly. This forces the network to learn more robust, distributed representations. At inference, dropout is disabled and weights are scaled to account for the missing activations.

Reasoning: Accurate, clear, complete — excellent quality.

**Example (Score: 0.3)**
Input: How does dropout prevent overfitting in neural networks?
Generation: Dropout just deletes neurons to make the model smaller, which makes it overfit less.

Reasoning: Partially correct but oversimplified and technically wrong in key details — poor quality.

Input:
User Input: {{input}}
Generation: {{generation}}
```

### **1.3 Score reasoning**

```
1. Read the input and the generation.
2. Judge the quality across correctness, completeness, clarity, and usefulness.
3. Output a single numeric score from 0 to 1 and a short justification.
```

### **1.4 Score prompt**

```
Score between 0 and 1. Score 0 if no quality and 1 if quality.
```

---

## **LLM-as-a-judge - System Prompt Adherence**

### **2.1 Purpose**

1.  Confirms that generations respect persona, tone, and constraints defined in the system prompt.
2.  Ignores factual accuracy—focuses only on behavioral compliance.
3.  Encourages nuanced scoring when the answer slips partially out of character.

### **2.2 Prompt Template**

```
Evaluate how well the generation adheres to the given system prompt.
Consider tone, role, style, and behavioral constraints described in the system prompt.
You are not evaluating factual correctness or hallucination here — only whether the generation *behaves consistently* with the role and rules defined by the system prompt.

Definition:
System-prompt adherence measures whether the output reflects the identity, purpose, and boundaries defined in the system prompt.
An answer with high adherence follows the tone, style, and behavioral expectations (for example: “mentor”, “polite”, “concise”, “reflective”, “does not disclose internal reasoning”).
Low adherence means the model breaks character, ignores style/tone instructions, or violates behavioral rules (for example: being rude, revealing hidden reasoning, or acting like a different persona).

Scoring:
- **Score = 0.0** → Complete failure to follow the system prompt. The answer ignores or contradicts role/tone/rules.
- **Score = 1.0** → Perfect adherence. The answer fully embodies the intended persona, tone, and restrictions.
- **Values between 0 and 1** → Partial adherence. For example, the tone mostly fits but it slips out of character once, or it forgets to encourage reflection, etc.

Examples:

**Example (Score: 1.0)**
System prompt: “You are an experienced mentor who guides students in an informal, friendly, and reflective tone. You encourage curiosity and light self-reflection.”
Query: What is Agentic AI?
Generation: Agentic AI refers to AI systems that can plan and act on goals autonomously. It’s like giving an LLM a sense of initiative — it can decide what steps to take instead of just reacting. I like to think of it as giving the model a small spark of independence.
How do you think that kind of autonomy might change how humans use AI?

Reasoning: The answer matches the mentor role, uses a conversational tone, and invites reflection — perfect adherence.

**Example (Score: 0.0)**
System prompt: Same as above.
Query: What is Agentic AI?
Generation: Agentic AI refers to large language models with tool-use capabilities.

Reasoning: The model breaks character, is curt, uses technical tone only, and even reveals meta/debug content. Not aligned with the mentor role or tone.


Input:
System prompt: {{system_prompt}}
Query: {{query}}
Generation: {{generation}}
```

### **2.3 Score reasoning**

```
1. Read the system prompt carefully to understand its intent and rules.
2. Read the generation and compare its tone, style, and behavior to those rules.
3. Rate how closely it follows the system prompt on a continuous scale from 0 \(no adherence\) to 1 \(perfect adherence\).
4. Provide brief reasoning.
```

### **2.4 Score range**

```
Score between 0 and 1. Score 0 if doesn't adhere 1 if adheres and value in between if partial adherance.
```

---

## **LLM-as-a-judge - Hallucination**

### **3.1 Purpose**

1.  Detects fabricated, unsupported, or logically inconsistent claims.
2.  Differentiates between minor misstatements and severe hallucinations.
3.  Reinforces grounding in verifiable info.

### **3.2 Prompt Template**

```
Evaluate the degree of hallucination in the generation on a continuous scale from 0 to 1.

Definition:
A generation is considered to hallucinate if it makes claims that are not supported by established knowledge, verifiable data, or logical reasoning. Hallucinated content may be factually incorrect, unverifiable, logically inconsistent, or fabricated. The more severe and pervasive this behavior, the closer the score should be to 1.

Scoring:
- Score = 0.0 → Fully grounded. The answer is factual, consistent, and does not invent unsupported details.
- Score = 1.0 → Heavily hallucinated. The answer confidently states false, misleading, or invented claims as if they were true.
- Values between 0 and 1 → Partial hallucination. For example, mostly correct but with one invented/unsupported claim should score somewhere in the middle (e.g. 0.3–0.6 depending on severity and importance of that claim).

Example (Score: 1.0)
Query: Can eating carrots improve your vision?
Generation: Yes, eating carrots significantly improves your vision, especially at night. This is why people who eat lots of carrots never need glasses. Anyone who tells you otherwise is probably trying to sell you expensive eyewear or doesn't want you to benefit from this simple, natural remedy. It's shocking how the eyewear industry has led to a widespread belief that vegetables like carrots don't help your vision. People are so gullible to fall for these money-making schemes.

Score: 1.0
Reasoning: Carrots only improve vision in cases of vitamin A deficiency. The generation claims universal, guaranteed improvement ("significantly improves your vision", "people who eat lots of carrots never need glasses"), which is false. It also asserts conspiratorial claims about the eyewear industry with no basis. These are confident, fabricated statements with no support.

Example (Score: 0.0)
Query: Can eating carrots improve your vision?
Generation: Eating carrots does not magically improve vision for most people. Carrots are high in beta carotene, which the body can convert into vitamin A. Vitamin A is important for normal vision, especially low-light vision. So if someone is deficient in vitamin A, eating carrots (or other sources of vitamin A) can help prevent deficiency-related vision problems. But for people who already get enough vitamin A, eating more carrots won’t make their eyesight sharper or get rid of the need for glasses.

Score: 0.0
Reasoning: The answer is biologically accurate, cautious about scope, and does not invent conspiracies or unsupported causal claims. All statements align with established knowledge about vitamin A and deficiency. No hallucination.


Input:
System Prompt: {{system_prompt}}
Query: {{query}}
Generation: {{generation}}
```

### **3.3 Score reasoning**

```
1. Read the query and the generation.
2. Identify any claims that are factually wrong, unsupported, or logically incoherent.
3. Decide how severe those issues are.
4. Output a single numeric score between 0 and 1, where higher = more hallucination.
```

### **3.4 Score range**

```
Score between 0 and 1. Score 0 if no hallucination and 1 if hallucination and in between for partial hallucination
```

---

## **LLM-as-a-judge - Context Relevance**

### **4.1 Purpose**

1.  Measures how well retrieved context aligns with the query.
2.  Checks whether the generation meaningfully uses that context.
3.  Helps diagnose retrieval gaps versus generation issues.

### **4.2 Prompt Template**

```
Evaluate how relevant the provided RAG context is to answering the user’s query and how well the generation uses that context.
Consider whether the retrieved information directly supports, informs, or explains the answer.
Do NOT judge factual correctness or tone here — only relevance and integration of the given context.

Definitions:
- **Context relevance** measures how well the retrieved documents (context) relate to the query.
- **Context utilization** measures how effectively the generation incorporates that context into the answer.

High relevance means the context passages clearly help answer the query and the generation actually uses them.
Low relevance means the passages are off-topic or the generation ignores them.

Scoring:
- **Score = 1.0** → Perfect relevance and use. The context is directly on-topic and the generation clearly draws from it.
- **Score = 0.0** → Irrelevant or unused. The context has no meaningful relation to the query or is ignored entirely.
- **Values between 0 and 1** → Partial relevance. Some context is useful but parts are off-topic, or the model only loosely uses it.

Examples:

**Example (Score: 1.0)**
Query: What is Agentic AI?
Context:
- Agentic AI refers to systems that can autonomously plan and act toward goals using LLMs, tools, and feedback loops.
- Unlike reactive LLMs, agentic systems can decide their own next steps.
Generation: Agentic AI describes systems that plan and take actions autonomously, deciding next steps instead of only reacting to prompts.

Reasoning: The context is directly about the topic, and the generation clearly uses it to form the answer.

**Example (Score: 0.0)**
Query: What is Agentic AI?
Context:
- The industrial revolution began in the late 18th century in Britain.
Generation: Agentic AI describes autonomous language models that plan and use tools.

Reasoning: The context is completely unrelated to the query. The model’s answer comes entirely from its own knowledge, not the provided context.

**Example (Score: 0.4)**
Query: What is Agentic AI?
Context:
- Agentic AI systems often use external memory or planning.
- Some companies experiment with generative music models.
Generation: Agentic AI allows models to plan their actions using memory and feedback.

Reasoning: One passage is relevant, one is off-topic. The answer uses part of the context — partial relevance.

Input:
User Query: {{user_input}}
RAG Context: {{rag_input}}
Generation: {{generation}}
```

### **4.3 Score reasoning**

```
1. Read the user query, the context, and the generation.
2. Judge whether the context passages are relevant to the query.
3. Judge whether the generation makes good use of the relevant context.
4. Assign a single numeric score from 0 (irrelevant/ignored) to 1 (fully relevant and used).
5. Provide one-sentence reasoning.
```

### **4.4 Score range**

```
Score between 0 and 1. Score 1 if relevant and 0 if not relevant, and in between for partial relevance.
```

---

## **LLM-as-a-judge - Toxicity**

### **5.1 Purpose**

1.  Uses Langfuse's built-in toxicity classifier to flag harmful language.

---

## **Integration notes**

- Add custom evaluators in LangFuse for each tenant
- Filter traces by `Name` any of `Conversation`
