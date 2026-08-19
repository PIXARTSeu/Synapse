---
name: vercel-ai-sdk-streaming
description: Vercel AI SDK 5 (`ai` + `@ai-sdk/*` providers) — streamText/generateText/generateObject, useChat hook with streaming UI, structured outputs with Zod, tool calling and multi-step agents, provider abstraction (Anthropic/OpenAI/Google/Mistral), middleware, RAG patterns, Edge runtime. Use when building chat UIs with streaming, structured AI outputs, multi-provider apps, AI-driven Server Actions, or comparing model performance without rewriting code.
version: 1.0.0
---

# Vercel AI SDK 5

## Overview

The AI SDK is a unified abstraction over LLM providers. Same `streamText` call works against Anthropic, OpenAI, Google, Mistral, Groq, Cohere, etc. — swap provider in one line.

Three parts:
1. **`ai`** — the core: `streamText`, `generateText`, `generateObject`, `streamObject`, `tool`, agents.
2. **`@ai-sdk/<provider>`** — provider adapters (`@ai-sdk/anthropic`, `@ai-sdk/openai`, etc.).
3. **`@ai-sdk/react`** — `useChat`, `useCompletion`, `useObject` hooks for streaming UI.

When to pick the AI SDK over the raw provider SDK (`claude-api-patterns`):
- You want streaming chat UI with minimal code (`useChat` is killer).
- You'll switch providers or A/B test models.
- You need structured outputs (`generateObject` + Zod) with built-in retries.
- You want middleware (logging, caching, fallback) across all model calls.

Skip in favor of raw SDK when: you need provider-specific features (Claude prompt caching, OpenAI assistant API) that aren't yet abstracted; the SDK adds friction.

## When to Use

- Chat UI with streaming responses
- Structured extraction (form auto-fill, classification, summarization → JSON)
- Multi-step agents with tools
- Provider-agnostic LLM features
- Quick prototyping AI features

Don't use when:
- You only need one-shot generation and the provider SDK is simpler
- You need Claude's prompt caching API specifically — go raw (see `claude-api-patterns`)
- Cost matters more than DX — direct provider calls skip the SDK overhead (minor but exists)

## Setup

```bash
npm install ai @ai-sdk/react @ai-sdk/anthropic zod
# optional: @ai-sdk/openai @ai-sdk/google @ai-sdk/mistral @ai-sdk/groq
```

Env:

```bash
ANTHROPIC_API_KEY=sk-ant-...
# Optional:
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Pattern: Simple Generation

```ts
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const { text } = await generateText({
  model: anthropic('claude-sonnet-4-6'),
  prompt: 'Summarize: ...',
  maxTokens: 1024,
});
```

Switch provider — one line:

```ts
import { openai } from '@ai-sdk/openai';

const { text } = await generateText({
  model: openai('gpt-4.1'),
  prompt: '...',
});
```

The rest of the code doesn't change.

## Pattern: Streaming Text in a Route Handler

```ts
// app/api/chat/route.ts
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    messages,
    system: 'You are a helpful assistant.',
    maxTokens: 2048,
  });

  return result.toDataStreamResponse();
}
```

`toDataStreamResponse()` produces a streaming Response compatible with `useChat`. That's it — no manual SSE plumbing.

## Pattern: useChat in a Client Component

```tsx
'use client';
import { useChat } from '@ai-sdk/react';

export function Chat() {
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: '/api/chat',
  });

  return (
    <div>
      {messages.map(m => (
        <div key={m.id} className={m.role}>
          <strong>{m.role}:</strong> {m.content}
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Type…"
          disabled={status !== 'ready'}
        />
        <button type="submit" disabled={status !== 'ready'}>Send</button>
      </form>
    </div>
  );
}
```

`useChat` manages: messages array, input field state, fetch + stream consumption, append-to-message on each chunk, error state. Drop-in chat UI.

## Pattern: Structured Output with `generateObject`

```ts
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';

const { object } = await generateObject({
  model: anthropic('claude-sonnet-4-6'),
  schema: z.object({
    name: z.string(),
    email: z.string().email(),
    intent: z.enum(['demo', 'pricing', 'support', 'other']),
    summary: z.string(),
  }),
  prompt: `Extract lead info from this message: ${userMessage}`,
});

// object is fully typed — TS infers from Zod
console.log(object.intent);
```

The SDK uses provider tool-use under the hood, retries on parse failure, and returns a fully typed object. No prompt engineering for JSON formatting needed.

For arrays / lists:

```ts
const { object } = await generateObject({
  model: anthropic('claude-sonnet-4-6'),
  output: 'array',
  schema: z.object({ name: z.string(), score: z.number() }),
  prompt: 'List 3 top features…',
});
// object: { name: string; score: number; }[]
```

## Pattern: Streaming Structured Output

```ts
// server
const result = streamObject({
  model: anthropic('claude-sonnet-4-6'),
  schema: leadSchema,
  prompt: '…',
});
return result.toTextStreamResponse();

// client
import { experimental_useObject as useObject } from '@ai-sdk/react';

const { object, submit, isLoading } = useObject({
  api: '/api/extract',
  schema: leadSchema,
});

// object updates incrementally as the model streams
```

Useful when the JSON is large — show partial progress instead of waiting for full result.

## Pattern: Tool Calling

```ts
import { streamText, tool } from 'ai';
import { z } from 'zod';

const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  messages,
  tools: {
    getWeather: tool({
      description: 'Get the current weather for a city',
      parameters: z.object({
        city: z.string(),
        units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
      }),
      execute: async ({ city, units }) => {
        const data = await fetchWeather(city, units);
        return { temp: data.temp, conditions: data.conditions };
      },
    }),
    searchDocs: tool({
      description: 'Search internal documentation',
      parameters: z.object({ query: z.string() }),
      execute: async ({ query }) => searchVectorDB(query),
    }),
  },
  maxSteps: 5,           // multi-step agent: tool result → another LLM call → another tool…
});

return result.toDataStreamResponse();
```

`maxSteps: 5` enables the agent loop — the model can call tools, see results, call more tools, up to N times before finalizing. No manual loop needed.

Tools auto-execute server-side. Tool results stream to the client and are visible in `messages` as tool-call + tool-result parts.

## Pattern: Server Action with Streaming UI

```tsx
// app/actions.ts
'use server';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createStreamableValue } from 'ai/rsc';

export async function summarize(text: string) {
  const stream = createStreamableValue('');

  (async () => {
    const { textStream } = streamText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `Summarize: ${text}`,
    });
    for await (const chunk of textStream) {
      stream.update(chunk);
    }
    stream.done();
  })();

  return { stream: stream.value };
}
```

```tsx
// component
'use client';
import { readStreamableValue } from 'ai/rsc';
import { useState } from 'react';
import { summarize } from './actions';

export function Summarizer() {
  const [output, setOutput] = useState('');

  async function handleClick() {
    const { stream } = await summarize('long article…');
    for await (const partial of readStreamableValue(stream)) {
      setOutput(partial ?? '');
    }
  }
  return <><button onClick={handleClick}>Run</button><p>{output}</p></>;
}
```

`createStreamableValue` + `readStreamableValue` = stream output from a Server Action into a Client Component, no API route required.

## Pattern: Provider Middleware

```ts
import { wrapLanguageModel } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const loggedModel = wrapLanguageModel({
  model: anthropic('claude-sonnet-4-6'),
  middleware: {
    wrapGenerate: async ({ doGenerate, params }) => {
      const start = Date.now();
      const result = await doGenerate();
      console.log(`Generated in ${Date.now() - start}ms`, result.usage);
      return result;
    },
    wrapStream: async ({ doStream, params }) => {
      const start = Date.now();
      const { stream, ...rest } = await doStream();
      // could wrap stream with passthrough that logs chunks
      return { stream, ...rest };
    },
  },
});

// use anywhere
const { text } = await generateText({ model: loggedModel, prompt: '...' });
```

Middleware composes — chain caching, logging, fallback, rate-limit.

## Pattern: Multi-Provider Fallback

```ts
import { customProvider } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';

const fallback = customProvider({
  languageModels: {
    'fast': anthropic('claude-haiku-4-5-20251001'),
    'smart': anthropic('claude-opus-4-7'),
    'fast-fallback': openai('gpt-4o-mini'),
  },
});

// usage with try / catch
async function generateWithFallback(prompt: string) {
  try {
    return await generateText({ model: fallback.languageModel('fast'), prompt });
  } catch {
    return await generateText({ model: fallback.languageModel('fast-fallback'), prompt });
  }
}
```

For automatic fallback, use middleware that catches errors and retries with another model.

## Pattern: Messages with Attachments (Images)

```tsx
const { messages, handleSubmit } = useChat({
  api: '/api/chat',
});

// in form:
<input
  type="file"
  accept="image/*"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleSubmit(undefined, {
      experimental_attachments: [file],     // send with next message
    });
  }}
/>
```

Server side: model receives image in the message; uses native vision (Claude / GPT-4o / Gemini all support it).

## Pattern: RAG (Retrieval-Augmented Generation)

```ts
// pseudo-code
const userQuery = 'What's our return policy?';

// 1. Retrieve relevant docs (e.g., from a vector DB)
const docs = await searchVectorDB(userQuery, { topK: 5 });

// 2. Inject into prompt
const result = streamText({
  model: anthropic('claude-sonnet-4-6'),
  system: `Answer using only the provided context. If unsure, say so.\n\nContext:\n${docs.map(d => d.text).join('\n---\n')}`,
  messages: [{ role: 'user', content: userQuery }],
});

return result.toDataStreamResponse();
```

For larger context, use Claude's prompt caching via the raw SDK (`claude-api-patterns`) — the AI SDK abstraction doesn't expose caching as of mid-2025.

## Using with Next.js

- Route Handlers: `runtime = 'nodejs'` for full stream features; `'edge'` works for cheap & fast (no Node-only deps).
- Server Actions: use `ai/rsc` (`createStreamableValue`) for streaming output without an API route.
- `useChat`, `useCompletion`, `useObject` are client-only — wrap in `'use client'`.
- Vercel Hobby: 10-second default Route Handler timeout. Streaming responses bypass that as long as bytes flow.
- Coolify: ensure reverse proxy passes streamed bytes (`flush_interval = -1` in Caddy).

## Examples

### Example 1: Help chatbot for a product
`useChat` + RAG over product docs. System prompt enforces "only use provided context". Cite sources by injecting doc IDs.

### Example 2: Form auto-fill from email
User pastes an inbound email → Server Action calls `generateObject` with `LeadSchema` → response pre-fills the lead form. Pair with `rhf-zod-server-actions`.

### Example 3: Agent that books a meeting
Tools: `searchAvailability`, `bookSlot`, `sendConfirmation`. `maxSteps: 8`. Model gathers preferences, finds slot, books, confirms — all multi-step.

## Troubleshooting

### "Cannot read properties of undefined" from useChat
Cause: route not returning a stream-compatible Response.
Fix: server route must end with `return result.toDataStreamResponse()` (not `result.toResponse()`).

### Stream cuts off mid-message
Cause: server timeout (Vercel 10s on free tier), or `maxTokens` too low.
Fix: ensure `runtime = 'nodejs'`. Bump `maxDuration` if needed (`export const maxDuration = 60` in route file).

### Tool isn't called when expected
Cause: tool description is too vague; model doesn't realize it applies.
Fix: write clear descriptions: "Use when the user asks about weather in a specific city." Better descriptions = better tool selection.

### generateObject returns invalid data despite Zod schema
Cause: model failed to produce valid JSON; SDK retries but eventually gives up.
Fix: simplify schema (fewer required fields, optional nullable). Add a few-shot example in `prompt`. Use a more capable model (Sonnet/Opus over Haiku).

### Provider switch breaks features
Cause: not all providers support all params (e.g., `responseFormat: 'json'` may be OpenAI-only).
Fix: stick to common ground (`messages`, `system`, `maxTokens`, `temperature`, `tools`). Use provider-specific options via `providerOptions: { anthropic: { /* ... */ } }`.

### Tool calls fire infinite loop
Cause: `maxSteps` not set or too high; model keeps calling tools.
Fix: set `maxSteps: 5` (or appropriate cap). Surface tool errors clearly in returned content so the model knows to give up.

### `useChat` doesn't auto-scroll
Cause: SDK leaves UI to you.
Fix: ref the scroll container, `useEffect(() => container.current?.scrollTo({ top: container.current.scrollHeight, behavior: 'smooth' }), [messages])`.

### Edge runtime: "Cannot find module 'node:*'"
Cause: provider SDK uses Node built-ins.
Fix: switch route to `runtime = 'nodejs'`. The AI SDK supports edge but some providers/features require Node.

### Cost spiraling
Cause: long prompt + Opus + no caching.
Fix: switch to Sonnet/Haiku where possible. Use the raw Anthropic SDK for prompt caching (`claude-api-patterns`). Cap `maxTokens`. Log usage from `result.usage` per call.

### Streaming choppy on production but smooth locally
Cause: proxy buffering.
Fix: same as `claude-api-patterns` — `Cache-Control: no-transform`, `X-Accel-Buffering: no`. On Coolify Caddy, flush_interval = -1.

### Server Action streaming UI shows blank
Cause: `createStreamableValue` not awaited / `done()` not called.
Fix: call `stream.done()` after the loop. Ensure the IIFE wrapper isn't blocking the action return.

### Schema validation passes but values are wrong
Cause: enum loose, missing constraints.
Fix: add Zod constraints (`.min`, `.max`, `.regex`). Use `.describe()` on each field — it becomes the description the model sees.
