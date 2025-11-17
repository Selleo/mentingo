# Evaluation Datasets — Langfuse

This guide walks you through uploading datasets and configuring powerful evaluators—Correctness, Hallucination, System Prompt Adherence, and Quality—to assess your LLM outputs using LLM-as-a-judge techniques.

> **Note:**  
> These datasets are designed for offline testing and are typically only needed in development environments.

## Evaluator Variable Mappings

### Correctness

| Variable           | Object  | Object Variable | Path    |
| ------------------ | ------- | --------------- | ------- |
| `{{query}}`        | Dataset | Input           | `input` |
| `{{generation}}`   | Trace   | Output          | —       |
| `{{ground_truth}}` | Dataset | Expected output | —       |

### System Prompt Adherence

| Variable            | Object  | Object Variable | Path    |
| ------------------- | ------- | --------------- | ------- |
| `{{system_prompt}}` | Trace   | Input           | —       |
| `{{query}}`         | Dataset | Input           | `input` |
| `{{generation}}`    | Trace   | Output          | —       |

### Quality

| Variable         | Object  | Object Variable | Path    |
| ---------------- | ------- | --------------- | ------- |
| `{{input}}`      | Dataset | Input           | `input` |
| `{{generation}}` | Trace   | Output          | —       |

### Hallucination

| Variable            | Object  | Object Variable | Path    |
| ------------------- | ------- | --------------- | ------- |
| `{{system_prompt}}` | Trace   | Input           | —       |
| `{{query}}`         | Dataset | Input           | `input` |
| `{{generation}}`    | Trace   | Output          | —       |

## Datasets

### Teacher/Mentor/Roleplay Dataset

**Input:** lessonTitle, lessonInstructions, securityAndRagBlock, input, groups  
**Expected Output:** answer

**Setup:**

1. Create a new dataset in Langfuse
2. Upload your CSV file
3. Map the input and output fields
4. Enable all four evaluators and configure variable mappings per the schema above

### Summary Dataset

**Input:** input
**Expected Output:** answer

**Setup:**

1. Create a new dataset in Langfuse
2. Upload your CSV file
3. Map the input and output fields
4. Enable all four evaluators and configure variable mappings per the schema above (Leave path empty)

### Judge Dataset

**Input:** lessonTitle, lessonInstructions, lessonConditions, input  
**Expected Outputs:** output, minScore, score, maxScore

**Setup:**

1. Create a new dataset in Langfuse
2. Upload your CSV file
3. Map the input and output fields
4. Enable all four evaluators and configure variable mappings per the schema above
