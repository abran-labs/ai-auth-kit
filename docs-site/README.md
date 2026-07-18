# AI Auth Kit documentation site

Astro Starlight source for <https://abran-labs.github.io/ai-auth-kit/>.

## Local development

```sh
bun install --frozen-lockfile
bun run dev
```

## Production checks

```sh
bun run check
bun test
SITE=https://abran-labs.github.io BASE=/ai-auth-kit/ bun run build
SITE=https://abran-labs.github.io BASE=/ai-auth-kit/ bun run validate:dist
SITE=https://abran-labs.github.io BASE=/ai-auth-kit/ bun run qa:browser
```

`SITE` is the GitHub Pages origin. `BASE` accepts blank, slashless, or slash-wrapped input and
normalizes to exactly one leading and trailing slash. The repository workflow owns deployment;
local QA never publishes the site.
