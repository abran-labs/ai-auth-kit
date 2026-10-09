---
title: Connect AI in the browser
description: Mount the hosted ConnectPanel, wire it to your server route, and theme it with CSS variables.
---

The hosted flow keeps provider secrets on your server. The browser only renders
`ConnectPanel` from the `@abran-labs/ai-auth-kit/react` subpath and forwards
opaque protocol messages. Follow the [library guide](/guides/library/) for install
wording; the snippets below assume the package is already installed.

## Mount the panel

```tsx
import { ConnectPanel, connectPanelCss, createFetchConnectTransport } from "@abran-labs/ai-auth-kit/react";

const transport = createFetchConnectTransport("/api/ai/connect");

export function AiSettings() {
  return (
    <>
      <style>{connectPanelCss}</style>
      <ConnectPanel
        transport={transport}
        onConnected={(connection) => console.log(connection.providerId)}
        onModelSelected={(summary) => console.log(summary.modelId)}
      />
    </>
  );
}
```

Wire `transport` to a server route that speaks the connect protocol and owns
token storage. The core package stays React-free; only this subpath needs the
`react` peer.

## Theme with CSS variables

The panel ships unstyled-but-usable semantic markup with stable `data-aak-*`
attributes. `connectPanelCss` is an optional tiny default stylesheet driven by
`--aak-accent`, `--aak-radius`, `--aak-border`, `--aak-muted`, and
`--aak-danger`. Override the variables or ignore the stylesheet and target the
`data-aak-*` attributes from your app's own CSS.

## Security

Never put provider secrets in browser storage. The server owns tokens; the
panel only collects user input (API keys, pasted redirect addresses, risk
confirmations) and posts it to your route. Secrets are cleared from panel state
on submit and never echoed back into the DOM.
