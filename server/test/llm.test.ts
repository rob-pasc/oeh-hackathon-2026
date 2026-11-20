import { DatabaseSync } from 'node:sqlite'
import { budgetedFetch, loadLimits } from '../src/limits.ts'
import { Type } from 'typebox'
import { describe, expect, it } from 'vitest'
import { createOpenAiCompatibleClient, LlmError, loadLlmConfig, type LlmConfig } from '../src/llm/index.ts'

const config: LlmConfig = {
  baseUrl: 'https://llm.test',
  apiKey: 'sk-test-secret',
  model: 'deepseek-flash',
  timeoutMs: 1000,
  thinking: { fact_extraction: 'enabled', explanation: 'disabled' },
}

const Answer = Type.Object({ status: Type.Literal('ok'), count: Type.Integer() }, { additionalProperties: false })

type Reply = { content: string; finish_reason?: string } | { status: number; body?: unknown } | 'hang'

/** Fake OpenAI-compatible provider: answers queued replies in order and records request bodies. */
function fakeProvider(...replies: Reply[]) {
  const requests: Record<string, any>[] = []
  const urls: string[] = []
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    urls.push(String(url))
    requests.push(JSON.parse(String(init?.body)))
    const reply = replies.shift() ?? { status: 500 }
    if (reply === 'hang')
      return new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))),
      )
    if ('status' in reply)
      return new Response(JSON.stringify(reply.body ?? { error: { message: 'error' } }), {
        status: reply.status,
        headers: { 'content-type': 'application/json' },
      })
    return new Response(
      JSON.stringify({
        id: 'cmpl-1',
        object: 'chat.completion',
        created: 0,
        model: 'deepseek-flash',
        choices: [{ index: 0, finish_reason: reply.finish_reason ?? 'stop', message: { role: 'assistant', content: reply.content } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }
  const client = createOpenAiCompatibleClient(config, { fetch: fetchImpl as typeof fetch, maxRetries: 0 })
  return { client, requests, urls }
}

const ask = (client: ReturnType<typeof fakeProvider>['client'], task: 'fact_extraction' | 'explanation' = 'explanation') =>
  client.completeJson({ task, system: 'Count things.', user: 'Count to 3.', schema: Answer })

describe('OpenAI-compatible client', () => {
  it.each(['repair', 'transport retry'])('charges every %s against the shared daily allowance', async (kind) => {
    const db = new DatabaseSync(':memory:')
    let attempts = 0
    const transport: typeof fetch = async () => {
      attempts++
      if (kind === 'transport retry') return new Response('', { status: 503, headers: { 'retry-after-ms': '1' } })
      return Response.json({ choices: [{ message: { content: 'invalid' } }] })
    }
    let day = '2026-11-20T23:59:59Z'
    const client = () => createOpenAiCompatibleClient(config, { fetch: budgetedFetch(db, 1, transport, () => new Date(day)) })
    try {
      await expect(ask(client(), 'fact_extraction')).rejects.toMatchObject({ kind: 'rate_limited' })
      await expect(ask(client())).rejects.toMatchObject({ kind: 'rate_limited' })
      expect(attempts).toBe(1)
      day = '2026-11-21T00:00:00Z'
      await expect(ask(client())).rejects.toMatchObject({ kind: 'rate_limited' })
      expect(attempts).toBe(2)
    } finally {
      db.close()
    }
  })

  it.each([
    { UPLOAD_MAX_BYTES: '32769' }, { UPLOADS_PER_HOUR: '-1' }, { REPORTS_PER_HOUR: '1.5' },
    { LLM_DAILY_CALLS: '' }, { TRUSTED_PROXY_IP: '0.0.0.0/0' },
  ])('rejects invalid deployment limits %j', (env) => {
    expect(() => loadLimits(env)).toThrow()
  })

  it('returns the validated value with metadata', async () => {
    const { client, urls } = fakeProvider({ content: '{"status":"ok","count":3}' })
    const result = await ask(client)
    expect(result).toMatchObject({ value: { status: 'ok', count: 3 }, model: 'deepseek-flash', attempts: 1 })
    expect(result.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 })
    expect(urls).toEqual(['https://llm.test/chat/completions'])
  })

  it('sends JSON mode, the model, and a system prompt containing "json" and the schema', async () => {
    const { client, requests } = fakeProvider({ content: '{"status":"ok","count":3}' })
    await ask(client)
    const body = requests[0]!
    expect(body).toMatchObject({ model: 'deepseek-flash', response_format: { type: 'json_object' }, stream: false })
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[0].content).toMatch(/json/)
    expect(body.messages[0].content).toContain('"const":"ok"')
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Count to 3.' })
  })

  it.each([
    ['fact_extraction', { type: 'enabled' }],
    ['explanation', { type: 'disabled' }],
  ] as const)('sends the configured thinking mode for %s', async (task, thinking) => {
    const { client, requests } = fakeProvider({ content: '{"status":"ok","count":1}' })
    await ask(client, task)
    expect(requests[0]!.thinking).toEqual(thinking)
  })

  it('omits the thinking parameter when configured as omit', async () => {
    const replies = [{ content: '{"status":"ok","count":1}' }]
    const requests: Record<string, unknown>[] = []
    const client = createOpenAiCompatibleClient(
      { ...config, thinking: { fact_extraction: 'omit', explanation: 'omit' } },
      {
        maxRetries: 0,
        fetch: (async (_url: unknown, init?: RequestInit) => {
          requests.push(JSON.parse(String(init?.body)))
          const r = replies.shift()!
          return new Response(
            JSON.stringify({ id: '1', object: 'chat.completion', created: 0, model: 'm', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: r.content } }] }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        }) as typeof fetch,
      },
    )
    await ask(client)
    expect(requests[0]).not.toHaveProperty('thinking')
  })

  it('accepts JSON wrapped in a Markdown code fence', async () => {
    const { client } = fakeProvider({ content: '```json\n{"status":"ok","count":2}\n```' })
    expect((await ask(client)).value).toEqual({ status: 'ok', count: 2 })
  })

  it('repairs once after an empty answer (DeepSeek JSON mode can return blank content)', async () => {
    const { client, requests } = fakeProvider({ content: '   ' }, { content: '{"status":"ok","count":3}' })
    const result = await ask(client)
    expect(result.attempts).toBe(2)
    expect(result.usage).toEqual({ prompt_tokens: 20, completion_tokens: 10 })
    const repair = requests[1]!.messages.at(-1)
    expect(repair.role).toBe('user')
    expect(repair.content).toContain('empty response')
  })

  it('repairs once after a schema violation, naming the invalid field', async () => {
    const { client, requests } = fakeProvider({ content: '{"status":"ok","count":"three"}' }, { content: '{"status":"ok","count":3}' })
    await ask(client)
    expect(requests[1]!.messages.at(-1).content).toContain('/count')
  })

  it('throws invalid_output when the repair also fails', async () => {
    const { client } = fakeProvider({ content: 'not json' }, { content: '{"status":"nope","count":1}' })
    const error = await ask(client).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LlmError)
    expect(error).toMatchObject({ kind: 'invalid_output' })
    expect((error as LlmError).details.join()).toContain('/status')
  })

  it('reports truncated output', async () => {
    const { client } = fakeProvider({ content: '{"status":"ok",', finish_reason: 'length' }, { content: '{"status":"ok",', finish_reason: 'length' })
    const error = (await ask(client).catch((e: unknown) => e)) as LlmError
    expect(error.details.join()).toContain('truncated')
  })

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limited'],
    [400, 'bad_request'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, kind) => {
    const { client } = fakeProvider({ status })
    await expect(ask(client)).rejects.toMatchObject({ name: 'LlmError', kind })
  })

  it('maps a timeout to kind timeout', async () => {
    const { client } = fakeProvider('hang')
    await expect(ask(client)).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('never puts the API key in error messages', async () => {
    const { client } = fakeProvider({ status: 401, body: { error: { message: 'bad key' } } })
    const error = (await ask(client).catch((e: unknown) => e)) as LlmError
    expect(error.message).not.toContain(config.apiKey)
    expect(error.details.join()).not.toContain(config.apiKey)
  })
})

describe('loadLlmConfig', () => {
  it('defaults to DeepSeek with thinking off for both tasks', () => {
    expect(loadLlmConfig({ LLM_API_KEY: 'k' })).toEqual({
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'k',
      model: 'deepseek-flash',
      timeoutMs: 25000,
      thinking: { fact_extraction: 'disabled', explanation: 'disabled' },
    })
  })

  it('reads overrides', () => {
    expect(
      loadLlmConfig({
        LLM_API_KEY: 'k',
        LLM_BASE_URL: 'https://other.example/v1',
        LLM_MODEL: 'other-model',
        LLM_TIMEOUT_MS: '5000',
        LLM_THINKING_FACT_EXTRACTION: 'omit',
        LLM_THINKING_EXPLANATION: 'enabled',
      }),
    ).toMatchObject({ baseUrl: 'https://other.example/v1', model: 'other-model', timeoutMs: 5000, thinking: { fact_extraction: 'omit', explanation: 'enabled' } })
  })

  it.each([
    [{}, 'LLM_API_KEY'],
    [{ LLM_API_KEY: 'k', LLM_BASE_URL: 'not a url' }, 'LLM_BASE_URL'],
    [{ LLM_API_KEY: 'k', LLM_TIMEOUT_MS: '-1' }, 'LLM_TIMEOUT_MS'],
    [{ LLM_API_KEY: 'k', LLM_THINKING_EXPLANATION: 'maybe' }, 'LLM_THINKING_EXPLANATION'],
  ])('rejects invalid config %j', (env, name) => {
    expect(() => loadLlmConfig(env)).toThrowError(expect.objectContaining({ kind: 'config', message: expect.stringContaining(name) }))
  })
})
