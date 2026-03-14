# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Sandbox Editor Setup

This repo now includes a Dev Container so you can open it in VS Code or Cursor inside an isolated Docker sandbox.

### What it does

- Runs the editor workspace inside a Linux container
- Keeps `node_modules` in a container volume instead of the Windows host
- Installs dependencies automatically with `npm ci`
- Forwards port `3001` for Next.js and `4000` for Genkit

### How to use it

1. Install Docker Desktop.
2. Open this folder in VS Code or Cursor.
3. Reopen the project in the container:
   - VS Code: `Dev Containers: Reopen in Container`
   - Cursor: use the Dev Containers / Reopen in Container command
4. Start the app with `npm run dev`

The container config lives in `.devcontainer/devcontainer.json`.
