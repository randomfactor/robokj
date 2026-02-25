# Project Goal: RoboKJ Web Extension
Build a Chrome Extension named "RoboKJ" using React (Vite), TypeScript, and Tailwind CSS.

## Directory Structure
Follow this specific structure for organization:
- `src/popup/`: Main extension window (React app).
- `src/background/`: Service worker logic (TypeScript).
- `src/content/`: Scripts for page injection (TypeScript).
- `src/components/`: Shared React components.
- `public/`: Static assets and manifest.json.

## Technical Requirements
1. **Bundler**: Vite with `@crxjs/vite-plugin`.
2. **Language**: TypeScript (strict mode).
3. **Manifest**: Version 3.
4. **Styling**: Tailwind CSS for the Popup and Options pages.

## Implementation Steps
1. Initialize a Vite React-TS project.
2. Install `@crxjs/vite-plugin` and configure `vite.config.ts`.
3. Set up `src/popup/index.html` as the default popup entry.
4. Create a background service worker in `src/background/index.ts`.
5. Ensure the `manifest.json` in `/public` correctly references these entry points.