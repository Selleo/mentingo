# Prompt Management Guide

This guide provides a complete walkthrough for creating, building, and integrating prompts with LangFuse in the Mentingo application.

---

### **Part 1: Create a New Prompt** ✍

#### **1.1 Define Prompt Template**

1. Navigate to `packages/prompts/src/templates/`.

2. Create a new YAML file with a descriptive name (e.g., `lesson-summary.yaml`).

3. Use the following structure:

   ```yaml
   id: lesson-summary
   description: Generates a concise summary of a lesson
   version: "1.0"

   template: |
     Summarize the following lesson in 2-3 sentences:

     Title: {{lessonTitle}}
     Content: {{lessonContent}}
     Language: {{language}}
   ```

4. Use **Handlebars** syntax (`{{variableName}}`) for variable injection in your local template.

#### **1.2 Define Variable Schema**

1. Open `packages/prompts/src/schemas/prompt.schema.ts`.

2. Create a TypeBox schema for your prompt variables using `Type.Object()`:

   ```typescript
   import { Type } from "@sinclair/typebox";

   export const LessonSummarySchema = Type.Object({
     lessonTitle: Type.String({
       description: "The title of the lesson",
     }),
     lessonContent: Type.String({
       description: "The full content of the lesson",
     }),
     language: Type.String({
       description: "Language code (e.g., 'en', 'pl')",
     }),
   });
   ```

#### **1.3 Register Prompt in PROMPT_MAP**

1. In `packages/prompts/src/schemas/prompt.schema.ts`, add your prompt to the `PROMPT_MAP`:

   ```typescript
   export const PROMPT_MAP = {
     "lesson-summary": LessonSummarySchema,
     // Add other prompts here
   } as const;
   ```

   The key must match the `id` from your YAML file.

---

### **Part 2: Build Prompts** 🔨

#### **2.1 Build the Prompts Package**

1. Run the build command from your project root:

   ```bash
   pnpm run build --filter=@repo/prompts
   ```

2. This compiles your YAML templates and TypeBox schemas into usable prompt definitions.

3. Verify the build was successful by checking the output directory.

---

### **Part 3: Use Prompts in Your Application**

#### **3.1 Inject PromptService**

1. In your service or controller, inject the `PromptService`:

   ```typescript
   import { PromptService } from "@repo/prompts";

   export class LessonService {
     constructor(private promptService: PromptService) {}

     async generateSummary(data: {
       lessonTitle: string;
       lessonContent: string;
       language: string;
     }): Promise<string> {
       const prompt = await this.promptService.loadPrompt("lesson-summary", data);
       // Use the rendered prompt with your LLM
       return prompt;
     }
   }
   ```

2. The `PromptService.loadPrompt()` method:
   - Validates input against your TypeBox schema.
   - Renders the Handlebars template with provided variables.
   - Returns the final prompt string.

---

### **Part 4: Integrate with LangFuse**

#### **4.1 Create Prompt in LangFuse UI**

1. Log in to your **LangFuse dashboard**.

2. Navigate to **Prompts** and click **Create new prompt**.

3. Configure the prompt:
   - **Name:** Must exactly match the `id` from your YAML file (e.g., `lesson-summary`).
   - **Variables:** Add each variable from your schema with exact names.

4. For the **Template**, use LangFuse variable syntax instead of Handlebars:

   **Important:** LangFuse does **NOT** support Handlebars syntax (expressions, loops, conditionals, etc.). While you can use Handlebars in your local YAML templates, these features won't be available in LangFuse UI. Stick to simple variable placeholders (`{{}}`) for full LangFuse compatibility.

   Convert your Handlebars template to LangFuse format:

   **Example schema:**

   ```
   Summarize the following lesson in 2-3 sentences:

   Title: {{lessonTitle}}
   Content: {{lessonContent}}
   Language: {{language}}
   ```

5. For **arrays and complex objects**, LangFuse will display them correctly in the UI. No need for loops or special syntax:

   **Local template (Handlebars):**

   ```
   Analyze the following lessons:
   {{#each lessons}}
   - {{this.title}}: {{this.content}}
   {{/each}}
   ```

   **LangFuse template (simple variables):**

   ```
   Analyze the following lessons:
   {{}}
   ```

   The array will be rendered as a JSON object in LangFuse, which is the correct representation.

6. Save the prompt in LangFuse.

#### **4.2 Keep Local YAML as Source of Truth**

**Important:** Always maintain the local YAML file as your **single source of truth**.

- Make all prompt edits in the local YAML file first.
- After building (`pnpm run build --filter=@repo/prompts`), update the corresponding prompt in LangFuse.
- Never edit prompts directly in LangFuse UI without updating the local YAML file.
- Remember to convert Handlebars syntax to LangFuse variable syntax when syncing.

---

### **Workflow Summary**

1. **Create** → Add YAML file in `packages/prompts/src/templates/` with Handlebars syntax
2. **Schema** → Define TypeBox schema in `packages/prompts/src/schemas/prompt.schema.ts`
3. **Register** → Add to `PROMPT_MAP`
4. **Build** → Run `pnpm run build --filter=@repo/prompts`
5. **Use** → Inject `PromptService` and call `loadPrompt()`
6. **Sync to LangFuse** → Create matching prompt with:
   - Same `id` as the name
   - Convert Handlebars to LangFuse `{{}}` syntax
   - Arrays and objects are displayed correctly without special handling
7. **Maintain** → Keep local YAML as source of truth

---

### **Best Practices**

- Use descriptive prompt IDs (camelCase).
- Document variable purposes in schema descriptions.
- Test prompts locally before syncing to LangFuse.
- Version your prompts (update `version` in YAML when making changes).
- Never edit prompts in LangFuse without updating the local file.
- Remember: **Local YAML uses Handlebars**, **LangFuse uses simple `{{}}` variables**.
- For complex data structures, let LangFuse display them as JSON—no loops needed.

---

### **Quick Reference: Handlebars → LangFuse Conversion**

| Local (Handlebars)            | LangFuse | Notes                                             |
| ----------------------------- | -------- | ------------------------------------------------- |
| `{{variableName}}`            | `{{}}`   | Simple variable                                   |
| `{{#if condition}}...{{/if}}` | N/A      | Use in local template only; simplify for LangFuse |
| `{{#each array}}...{{/each}}` | `{{}}`   | Pass array as-is; LangFuse will render as JSON    |
| `{{object.property}}`         | `{{}}`   | Pass object as-is; LangFuse will render as JSON   |
