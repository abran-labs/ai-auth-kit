import { expect, test } from "bun:test";

import { fetchModelsDevCatalog } from "./catalog-http.js";

const BODY = JSON.stringify({ provider: { id: "provider" } });

test("Given a 200 response, when the catalog is fetched, then it returns body and ETag", async () => {
  // Given: a local transport that returns a bounded catalog response.
  const fetch = async (): Promise<Response> => new Response(BODY, { headers: { etag: '"A"' } });

  // When: the catalog client requests it.
  const result = await fetchModelsDevCatalog({ fetch, url: "http://fixture.test/catalog", etag: null });

  // Then: source bytes and conditional metadata are available.
  expect(result).toEqual({ kind: "fresh", body: BODY, etag: '"A"' });
});

test("Given a conditional 304 response, when the catalog is fetched, then it preserves cache state", async () => {
  // Given: a local transport receiving a prior ETag.
  const fetch = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    expect(new Headers(init?.headers).get("if-none-match")).toBe('"A"');
    return new Response(null, { status: 304 });
  };

  // When: the client conditionally refreshes.
  const result = await fetchModelsDevCatalog({ fetch, url: "http://fixture.test/catalog", etag: '"A"' });

  // Then: it explicitly reports not-modified.
  expect(result).toEqual({ kind: "not-modified" });
});

test("Given missing or changing ETags, when responses succeed, then both remain valid", async () => {
  // Given: two legitimate responses, first without and second with an ETag.
  const withoutEtag = async (): Promise<Response> => new Response(BODY);
  const changingEtag = async (): Promise<Response> => new Response(BODY, { headers: { etag: '"B"' } });

  // When: each is fetched.
  const first = await fetchModelsDevCatalog({ fetch: withoutEtag, url: "http://fixture.test/catalog", etag: '"A"' });
  const second = await fetchModelsDevCatalog({ fetch: changingEtag, url: "http://fixture.test/catalog", etag: '"A"' });

  // Then: ETags are optional and updated only from successful responses.
  expect(first).toEqual({ kind: "fresh", body: BODY, etag: null });
  expect(second).toEqual({ kind: "fresh", body: BODY, etag: '"B"' });
});

test("Given 429 and 503 transient failures and an oversized body, when fetched, then only transient statuses retry", async () => {
  // Given: a flaky server and an oversized response.
  let attempts = 0;
  const flaky = async (): Promise<Response> => {
    attempts += 1;
    return attempts === 1 ? new Response(null, { status: 429 }) : new Response(BODY);
  };
  const oversized = async (): Promise<Response> => new Response("x".repeat(33));
  let unavailableAttempts = 0;
  const unavailable = async (): Promise<Response> => {
    unavailableAttempts += 1;
    return unavailableAttempts === 1 ? new Response(null, { status: 503 }) : new Response(BODY);
  };

  // When: fetch policy is applied.
  const recovered = await fetchModelsDevCatalog({ fetch: flaky, url: "http://fixture.test/catalog", etag: null, retries: 1 });
  const recoveredUnavailable = await fetchModelsDevCatalog({ fetch: unavailable, url: "http://fixture.test/catalog", etag: null, retries: 1 });

  // Then: transient status retries once; permanent body limits never enter the catalog.
  expect(recovered.kind).toBe("fresh");
  expect(attempts).toBe(2);
  expect(unavailableAttempts).toBe(2);
  expect(recoveredUnavailable.kind).toBe("fresh");
  await expect(fetchModelsDevCatalog({ fetch: oversized, url: "http://fixture.test/catalog", etag: null, maxBytes: 32 })).rejects.toThrow("response limit");
});

test("Given a hanging body, when the shared ten-second deadline expires, then retries cannot extend it", async () => {
  // Given: a local fixture honoring the abort signal rather than resolving.
  let calls = 0;
  const hanging = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => new Promise((_, reject) => {
    calls += 1;
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  });

  // When: a short total deadline covers the full retry loop.
  const started = performance.now();
  await expect(fetchModelsDevCatalog({ fetch: hanging, url: "http://fixture.test/catalog", etag: null, timeoutMs: 20, retries: 2 })).rejects.toThrow();

  // Then: one deadline bounds every attempt; it does not become retry-count times timeout.
  expect(calls).toBe(1);
  expect(performance.now() - started).toBeLessThan(200);
});

test("Given terminal HTTP and body failures, when fetched, then each uses exactly one attempt", async () => {
  // Given: policy, client, and body-boundary failures.
  const cases = [
    { label: "404", response: new Response(null, { status: 404 }), options: {} },
    { label: "400", response: new Response(null, { status: 400 }), options: {} },
    { label: "oversized", response: new Response("x".repeat(33)), options: { maxBytes: 32 } },
  ] as const;

  // When: each terminal outcome is requested with spare retry budget.
  for (const fixture of cases) {
    let attempts = 0;
    const fetch = async (): Promise<Response> => {
      attempts += 1;
      return fixture.response;
    };
    await expect(fetchModelsDevCatalog({ fetch, url: "http://fixture.test/catalog", etag: null, retries: 2, ...fixture.options })).rejects.toThrow();

    // Then: no terminal failure consumes retry budget.
    expect(attempts, fixture.label).toBe(1);
  }
});

test("Given malformed and network transport errors, when fetched, then only network reset retries", async () => {
  // Given: a syntax failure and a recoverable transport reset.
  let malformedAttempts = 0;
  const malformed = async (): Promise<Response> => {
    malformedAttempts += 1;
    throw new SyntaxError("malformed");
  };
  let networkAttempts = 0;
  const network = async (): Promise<Response> => {
    networkAttempts += 1;
    if (networkAttempts === 1) throw new TypeError("network reset");
    return new Response(BODY);
  };

  // When: both failures run under the same retry policy.
  await expect(fetchModelsDevCatalog({ fetch: malformed, url: "http://fixture.test/catalog", etag: null, retries: 2 })).rejects.toThrow("malformed");
  const recovered = await fetchModelsDevCatalog({ fetch: network, url: "http://fixture.test/catalog", etag: null, retries: 2 });

  // Then: parse errors stop immediately while transport reset recovers.
  expect(malformedAttempts).toBe(1);
  expect(networkAttempts).toBe(2);
  expect(recovered.kind).toBe("fresh");
});
