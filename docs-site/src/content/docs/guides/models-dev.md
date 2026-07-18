---
title: Models.dev catalog
description: Learn how live model metadata, cache fallback, and historical selections work.
---

AI Auth Kit reads provider and model metadata from `https://models.dev/api.json`. Catalog totals
are intentionally not part of the compatibility contract because the source changes.

## Refresh order

1. Use the current in-memory view.
2. Attempt a conditional refresh when the five-minute guard allows it.
3. Save a valid normalized response with ETag and content SHA-256 provenance.
4. On failure, use the last valid cache.
5. With no valid cache, use the tracked bundled snapshot.

`ready()` refreshes once for normal startup. `startCatalogRefresh()` opts a long-running process
into hourly attempts. `catalog refresh` requests a refresh from the CLI.

## What remote metadata cannot do

The catalog schema accepts metadata only. It cannot define:

- executable paths or command flags;
- login behavior;
- request headers or bodies;
- credentials;
- local authentication policy.

## Historical selections

Each selected model includes an immutable provider/model snapshot. If the live catalog removes
the entry, it disappears from new choices but remains resolvable for existing state. A refresh
failure never rewrites credentials or selections.
