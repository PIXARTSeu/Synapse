---
name: claude-api-patterns
description: Anthropic Claude API patterns with the official `@anthropic-ai/sdk` — model selection (Opus 4.7 / Sonnet 4.6 / Haiku 4.5), streaming, prompt caching, tool use, structured output, vision, batch API, retry/backoff, cost control, Next.js Route Handler and Server Action wiring. Use when building features that call Claude (chat, summarization, agents, classifications), debugging tool-use loops, optimizing token cost via caching, or migrating between Claude model versions.
version: 1.0.0
---

# Claude API — Production Patterns

## Overview

The Anthropic SDK (`@anthropic-ai/sdk`) is a thin wrapper over the `/v1/messages` HTTP endpoint. Production usage hinges on five orthogonal concerns:

1. **Model selection** — Opus for reasoning, Sonnet for balance, Haiku for fast/cheap.
2. **Prompt caching** — 90% cost cut + 85% latency cut on repeated system / context prefixes.
3. **Streaming** — required for any user-facing chat or long generation.
4. **Tool use** — multi-turn loops where Claude calls your functions.
5. **Structured output** — guaranteed JSON via tool-use or response prefill.

Every Claude integration touches at least 1-2 of these. This skill is the practical playbook.

## When to Use

- Adding "AI" features to a Next.js app (chat, classification, summarization, RAG)
- Building an MCP server / agent that loops with tools
- Optimizing token bills (caching, batch API)
- Streaming chat UI with the Vercel AI SDK alternative (direct streaming)
- Vision use cases (image analysis, OCR, screenshot diff)
- Migrating from `claude-3-*` to `claude-4-*` or `claude-sonnet-4-5` → `claude-sonnet-4-6`

Don't use when:
- You're better served by the Vercel AI SDK abstraction (`ai-sdk` skill exists separately)
- The task is structured-output-only and Claude is overkill — try smaller models

## Setup

```bash
npm install @anthropic-ai/sdk
```

Env (`.env.local`):

```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

Client instance — **always server-side**:

```ts
// lib/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Optional: maxRetries, timeout, defaultHeaders
});
```

Never expose the key to the browser. All calls must originate from Server Actions, Route Handlers, or a backend service.

## Model Selection (April 2026)

| Model ID | Use case | Cost (per 1M tokens, input/output) |
|---|---|---|
| `claude-opus-4-7` | Deep reasoning, agents, code review, architecture | $15 / $75 |
| `claude-sonnet-4-6` | Default balanced — most production calls | $3 / $15 |
| `claude-haiku-4-5-20251001` | Classification, simple extraction, fast UX | $0.80 / $4 |

Default to **Sonnet** unless you have a specific need. Opus is 5x the cost; only use it where the reasoning gap justifies it (agent loops, hard generation tasks). Haiku is 4x cheaper than Sonnet; use it for high-volume narrow tasks.

For latest model IDs always check `https://docs.claude.com/en/docs/about-claude/models/overview`.

## Pattern: Minimal Message

```ts
import { anthropic } from '@/lib/anthropic';

const msg = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Summarize: <text>' },
  ],
});

console.log(msg.content[0].type === 'text' ? msg.content[0].text : '');
```

Key fields:
- `max_tokens` — **required**. Output cap. Start at 1024; raise as needed.
- `system` — instructions; not a `role: 'system'` message. Pass as a top-level prop.
- `temperature` — defaults to 1.0. Lower (0–0.3) for deterministic; higher (0.7–1.0) for creative.

## Pattern: Prompt Caching (90% cheaper repeats)

Mark long, static prefixes with `cache_control`. Subsequent calls within 5 minutes (default) hit the cache.

```ts
const msg = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  system: [
    {
      type: 'text',
      text: longSystemPrompt,     // your style guide, persona, rules
      cache_control: { type: 'ephemeral' },
    },
  ],
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: largeContextDocument,   // RAG context, code repo, transcript
          cache_control: { type: 'ephemeral' },
        },
        { type: 'text', text: 'Question: ...' },
      ],
    },
  ],
});
```

Rules:
- Cache breakpoints: up to **4 per request**.
- Minimum cacheable size: **1024 tokens** (Sonnet/Opus) or **2048 tokens** (Haiku).
- TTL: 5 min default; **1-hour** opt-in via `cache_control: { type: 'ephemeral', ttl: '1h' }` (premium).
- Caching is per-prefix — **everything before** a `cache_control` mark is part of that prefix. Change anything before it = cache miss.

Pricing:
- **Cache writes**: 1.25× normal input price (one-time).
- **Cache reads**: 0.1× normal input price (huge savings).

A typical RAG app caching a 50K token context and asking 20 questions cuts input cost by ~85% and time-to-first-token by ~80%.

Inspect cache hits in the response:

```ts
console.log(msg.usage);
// { input_tokens: 25, cache_creation_input_tokens: 0, cache_read_input_tokens: 51234, output_tokens: 312 }
```

## Pattern: Streaming (chat UI / long generation)

```ts
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  messages: [{ role: 'user', content: 'Write a long essay…' }],
});

for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    process.stdout.write(event.delta.text);
  }
}

// Or grab the final message:
const final = await stream.finalMessage();
```

### Next.js Route Handler — Server-Sent Events

```ts
// app/api/chat/route.ts
import { anthropic } from '@/lib/anthropic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
```

Client consumes via `EventSource` or `fetch` + reader. Vercel AI SDK gives a nicer DX if you want it; this skill shows the SDK-direct path used by SkillBrain core.

## Pattern: Tool Use

You define functions; Claude decides when to call them.

```ts
const tools: Anthropic.Tool[] = [
  {
    name: 'get_weather',
    description: 'Get the current weather for a city',
    input_schema: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['city'],
    },
  },
];

async function runConversation(userMsg: string) {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMsg }];

  while (true) {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason === 'end_turn') {
      return res.content;
    }

    if (res.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
            // is_error: true if the tool failed
          });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;   // back to Claude with the results
    }

    throw new Error(`Unexpected stop_reason: ${res.stop_reason}`);
  }
}
```

The loop: **call → assistant content → tool_use blocks → run tools → tool_result blocks → call again**. Stop when `stop_reason === 'end_turn'`.

Cap the loop:

```ts
let turns = 0;
while (turns++ < 20) { /* ... */ }
throw new Error('Tool use loop did not terminate');
```

20 is a sensible default; runaway loops are the #1 production bug in agentic apps.

## Pattern: Structured Output via Tool Use

The reliable way to get strict JSON: define a tool you never actually execute.

```ts
const tools: Anthropic.Tool[] = [
  {
    name: 'extract_lead',
    description: 'Extract lead information from text',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        company: { type: 'string', nullable: true },
        intent: { type: 'string', enum: ['demo', 'pricing', 'support', 'other'] },
      },
      required: ['name', 'email', 'intent'],
    },
  },
];

const res = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  tools,
  tool_choice: { type: 'tool', name: 'extract_lead' },  // force this tool
  messages: [{ role: 'user', content: rawText }],
});

const block = res.content.find((b) => b.type === 'tool_use');
const data = block?.type === 'tool_use' ? (block.input as ExtractLead) : null;
```

`tool_choice` forces a specific tool. Combine with Zod validation on `data` for defense in depth.

## Pattern: Response Prefill (lightweight JSON / format lock)

When tool use is overkill, prefill the assistant turn:

```ts
const res = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'List 3 cities in JSON.' },
    { role: 'assistant', content: '{"cities":' },   // prefill
  ],
});
// Output continues from `{"cities":` — guaranteed start.
```

Prepend the prefill string to the response to assemble valid JSON. Cheaper than tool use; less strict.

## Pattern: Vision

Pass image as `image` content block — base64 or URL:

```ts
const res = await anthropic.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64String,
        },
      },
      { type: 'text', text: 'What is shown here?' },
    ],
  }],
});
```

URLs work too: `source: { type: 'url', url: 'https://...' }`. Image tokens: ~1568 per 1MP. Resize before sending — anything > 1568px on the long edge is downsampled anyway.

## Pattern: Batch API (50% cheaper, 24h SLA)

For non-realtime workloads (analytics, embedding generation, bulk classification):

```ts
const batch = await anthropic.messages.batches.create({
  requests: items.map((item, i) => ({
    custom_id: `item-${i}`,
    params: {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: `Classify: ${item.text}` }],
    },
  })),
});

// poll
const status = await anthropic.messages.batches.retrieve(batch.id);

// when status.processing_status === 'ended', fetch results
const results = await anthropic.messages.batches.results(batch.id);
for await (const result of results) {
  // result.custom_id, result.result.message etc.
}
```

50% discount on input + output. Use for jobs that can wait minutes-to-hours.

## Pattern: Retry & Error Handling

The SDK retries on 5xx / network errors automatically (`maxRetries: 2` default). Customize:

```ts
new Anthropic({ maxRetries: 5, timeout: 60_000 });
```

Catch typed errors:

```ts
import Anthropic from '@anthropic-ai/sdk';

try {
  await anthropic.messages.create({ /* ... */ });
} catch (err) {
  if (err instanceof Anthropic.APIError) {
    console.error(err.status, err.message, err.headers);
  }
  if (err instanceof Anthropic.RateLimitError) {
    // 429 — backoff and retry
  }
  if (err instanceof Anthropic.BadRequestError) {
    // 400 — your request is malformed, don't retry
    throw err;
  }
  throw err;
}
```

Rate limits are per-model + per-org. Inspect `err.headers['anthropic-ratelimit-*']` to see remaining budget.

## Cost Control Checklist

- **Cache** long system prompts and RAG context with `cache_control`.
- **Pick the smallest model** that does the job. Haiku for classify; Sonnet default; Opus only when needed.
- **Cap `max_tokens`** — match it to what you actually need. The model won't always use it, but the API contract reserves it for budgeting.
- **Use Batch API** for any async > realtime workload.
- **Log usage** — write `msg.usage` to your DB per call. Build a daily report.
- **Prefer prefill or tool-use for JSON** over post-hoc parsing — fewer retries on malformed output.

## Using with Next.js

- All calls server-side. Server Action / Route Handler / Server-only function.
- `export const runtime = 'nodejs'` for streaming routes — Edge runtime has SSE quirks.
- Vercel Hobby: Route Handlers have 10s default timeout but extensible to 60s with `export const maxDuration = 60`.
- For agents / long tool-use loops: push to a queue (Inngest, Trigger.dev) — synchronous routes will time out.
- Use **AI Gateway** (Vercel) or **Helicone** for multi-provider proxy + logs if you want to swap models without changing code.

## Examples

### Example 1: Article summarizer
Server Action, Sonnet, cache the system prompt with style guide. Input article up to 10K tokens; output 200-word summary. Latency target < 5s.

### Example 2: Lead extraction from contact form
Form submission → Server Action → Claude with forced tool use `extract_lead` → write structured row to Supabase → trigger CRM webhook. Use Haiku for speed.

### Example 3: Agent loop in MCP server
Tool use loop with 6 tools (search code, read file, write file, run tests, ask user, finish). Cap at 30 turns. Stream events to UI via SSE. Use Opus.

## Troubleshooting

### "401 Unauthorized" on first call
Cause: missing or wrong API key.
Fix: confirm `process.env.ANTHROPIC_API_KEY` is set. In Next.js, restart `next dev` after editing `.env.local`. Keys must start with `sk-ant-api03-`.

### "529 Overloaded" / occasional 5xx
Cause: Anthropic capacity / regional spike.
Fix: SDK retries automatically. For high-volume apps, set `maxRetries: 5` and add circuit-breaker logic. Switch to Batch API for non-realtime.

### Cache misses despite identical-looking input
Cause: minimum cacheable size not met, or invisible whitespace/Unicode difference in the prefix.
Fix: confirm the cached prefix is ≥ 1024 tokens (Sonnet/Opus). Inspect `msg.usage.cache_read_input_tokens` — 0 = miss. Normalize whitespace before sending.

### Tool use loop never terminates
Cause: Claude keeps calling the same tool with similar input, or your tool always returns errors.
Fix: cap the loop (`while turns < 20`). Surface tool errors clearly in `tool_result.content` — Claude reacts to failure messages. If a tool consistently fails, return `is_error: true`.

### Streaming hangs in production but works locally
Cause: proxy or CDN buffering SSE.
Fix: set `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`. On Coolify with Caddy, ensure `flush_interval = -1` for streamed routes. On Vercel Edge runtime, streaming works without extra config.

### Output cut off mid-sentence
Cause: hit `max_tokens` limit.
Fix: raise `max_tokens`. Check `msg.stop_reason === 'max_tokens'` to detect; consider summarizing in two passes for very long output.

### "Invalid model" error after upgrade
Cause: model ID changed (e.g. `claude-3-5-sonnet-20241022` → `claude-sonnet-4-6`).
Fix: check docs.claude.com for current IDs. Pin a date-stamped variant for reproducibility (e.g. `claude-haiku-4-5-20251001`).

### Tool input not what you expected
Cause: input_schema too permissive; Claude infers wrong types.
Fix: tighten the JSON schema. Add `enum` constraints for categoricals. Add `description` to each property — Claude reads them.

### Vision: image rejected
Cause: > 5 MB, unsupported format, or > 100 images per message.
Fix: PNG/JPEG/GIF/WebP only. Resize to < 5 MB. Long edge auto-clamps to 1568px. For batch image analysis, send one per message.

### Rate limit despite low volume
Cause: free / introductory tier has lower limits; or your key is bound to multiple apps.
Fix: check Anthropic Console → Settings → Plans. Increase via Pro plan or contact sales. Inspect `anthropic-ratelimit-*` response headers.

### Bills surprise spike
Cause: forgot to cap `max_tokens`, an unbounded tool loop, or accidentally on Opus.
Fix: re-read Cost Control checklist. Add per-feature spend monitoring. Set spend limits in Anthropic Console.
