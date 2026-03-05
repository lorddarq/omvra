# Plumy

Plumy is an Electron desktop project-management app with:
- a timeline canvas (project swimlanes)
- a Kanban board (status columns)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Useful variants:

```bash
npm run dev:vite      # renderer only
npm run dev:electron  # electron only (expects Vite to be running)
```

## Build

```bash
npm run build
npm run build:electron
```

## Task UX (Current Behavior)

- Clicking a task opens a **read-only Task Details dialog**.
- Task description/notes in that dialog are rendered as **Markdown**.
- Full editing is available via **Kanban card `Edit` button** and from task creation flows.
- Timeline visibility is based on project assignment:
  - if task has a project/swimlane assignment, it can appear on timeline
  - if project assignment is empty (`No project (Kanban only)`), it does not appear on timeline

## Main Tech

- React + TypeScript + Vite
- Tailwind CSS
- Electron
- react-dnd
