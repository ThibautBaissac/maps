# Repository Guidelines

## Project Structure & Module Organization

The application is a static TypeScript 7 site built with Vite. Browser code lives in `src/`. Shared map rendering helpers belong in `src/toolkit/`; visual implementations belong in `src/styles/<style>/`; each map subject belongs in `src/topics/<topic>/` (pure analysis in `evidence.ts`, its `TopicDef` in `index.ts`, its texts in all five languages in `messages.ts`), registered in `src/topics/index.ts` and `src/topics/messages.ts`; the subject's texts become `topics.<subject>` of each dictionary, starting with its facts and method. Other translations belong in `src/i18n/`, where `maps.<map-id>` holds the question and intro written in that map's voice. Each map's voice is defined in `voices/<map-id>.md`. Keep place metadata in `places/index.ts`, the external layers of each place in `places/layers.ts`, and map registrations in `src/registry.ts`.

Node scripts live in `scripts/`. Tests live in `tests/` and mirror the domain they cover, such as `tests/catalogue.test.ts`. Store committed OpenStreetMap extracts and converted layer files in `public/data/`, GeoJSON layer sources in `layers/<place>/<id>.geojson`, local fonts in `public/fonts/`, and gallery and link-preview images in `public/vignettes/<locale>/`. Vite generates localized page directories during development and build; do not commit them.

## Build, Test, and Development Commands

- `npm ci`: install the locked dependencies. Use Node 24 or newer.
- `npm run dev`: start the Vite development server at `/maps/`.
- `npm test`: run all Node test-runner suites.
- `npm run typecheck`: check strict TypeScript without emitting files.
- `npm run build`: type-check, validate translations and map data, then create `dist/`.
- `npm run fetch-data -- <place-id>`: download OpenStreetMap data for a registered place and write its layer file, `public/data/<place-id>/osm.json`.
- `npm run layers -- <place-id>`: convert the GeoJSON sources declared in `places/layers.ts` into layer files in `public/data/<place-id>/`.
- `npm run vignettes -- <map-id>`: regenerate localized gallery and link-preview images while the development server runs; `--missing` takes only the versions without them. The build fails while a map lacks either picture in any locale.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, semicolons, and ESM imports with explicit `.ts` extensions. Follow the strict options in `tsconfig.base.json`; avoid `any` and handle indexed access explicitly. Use `camelCase` for variables and functions, `PascalCase` for types, and kebab-case for map, place, and style identifiers. Keep browser-free domain types reusable by both Vite and Node scripts.

## Testing Guidelines

Use `node:test` with `node:assert/strict`. Name files `<subject>.test.ts` and describe observable behavior in each test title. Add regression tests for bug fixes and unit tests for pure conversion, catalogue, translation, layout, or rendering logic. The repository has no numeric coverage threshold. Run `npm test` and `npm run build` before submitting changes.

## Commit & Pull Request Guidelines

Write short imperative commit subjects, matching history: `Add French, English and Spanish localization`. Keep each commit focused. Pull requests should explain the user-visible result, list validation commands, and link related issues. Include screenshots for gallery, map, responsive, or localization changes. Note regenerated data or vignettes and commit those outputs. Confirm keyboard navigation and readable descriptions for interface changes.
