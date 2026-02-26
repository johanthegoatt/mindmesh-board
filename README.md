# MindMesh Board

## Description
MindMesh Board is a local-first mind-mapping web app where you can place idea nodes, connect them, drag them, and simulate collaboration using in-browser sync channels.

## Features
- Interactive node creation with drag repositioning
- Node-to-node linking to model concept relationships
- Local sync simulation using `BroadcastChannel` with fallback events
- Snapshot merging strategy to apply newer remote node updates
- Node management actions: rename and delete
- Undo/redo snapshot history
- Local autosave + restore between sessions
- Keyboard shortcuts for productivity (`N`, `Delete`, `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`)
- Static browser-ready UI with no backend dependency

## Run
```bash
cd mindmesh-board
npm run dev
```
Open `http://127.0.0.1:8091/mindmesh-board/index.html`.

## Test
```bash
cd mindmesh-board
npm test
```

## Project Structure
```text
mindmesh-board/
  index.html
  styles.css
  app.js
  src/
    boardState.js
    history.js
    persistence.js
    syncBus.js
  tests/
    boardState.test.js
    history.test.js
```
