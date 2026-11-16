import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { request } from './client'

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
const status = (code: number) => new Response('', { status: code })
const offline = () => Promise.reject(new TypeError('Failed to fetch'))

/** Runs a request while fake timers skip the pauses between attempts. */
async function settle<T>(promise: Promise<T>) {
  const result = promise.then(
    (value) => ({ value }),
    (error: Error) => ({ error }),
  )
  await vi.runAllTimersAsync()
  return result
}

describe('request retries', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('retries a read while the server wakes up', async () => {
    fetchMock
      .mockImplementationOnce(offline)
      .mockResolvedValueOnce(status(503))
      .mockResolvedValueOnce(ok([{ id: 'c1' }]))
    const result = await settle(request('/categories'))
    expect(result).toEqual({ value: [{ id: 'c1' }] })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('gives up after three attempts with a message in Portuguese', async () => {
    fetchMock.mockImplementation(offline)
    const result = await settle(request('/categories'))
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect((result as { error: Error }).error.message).toMatch(/Sem conexão com o servidor/)
  })

  it('sends a write only once, since the API may have applied it', async () => {
    fetchMock.mockImplementation(offline)
    const result = await settle(request('/contracts', { method: 'POST', body: '{}' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((result as { error: Error }).error.message).toMatch(/Sem conexão/)
  })

  it('does not retry an answer from the API itself', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Serviço não encontrado.' }), { status: 404 }),
    )
    const result = await settle(request('/services/x'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((result as { error: Error }).error.message).toBe('Serviço não encontrado.')
  })

  it('explains a timeout instead of showing the browser message', async () => {
    fetchMock.mockRejectedValue(new DOMException('signal timed out', 'TimeoutError'))
    const result = await settle(request('/categories'))
    expect((result as { error: Error }).error.message).toMatch(/demorou para responder/)
  })
})
