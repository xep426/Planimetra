# Planimetra

Yet another 2D floor-plan sketcher -- except it's the one I wanted to use, so I built it (and I needed DXF export functionality).

![Planimetra desktop screenshot](public/screenshot_desktop.jpg)

## Live Demo

- https://planimetra.com

## Features

- 2D canvas for drawing floor plans
- Walls, doors, windows, columns, and passages
- Measurements and geometry helpers
- Wall editing (delete, change length/type/thickness)
- Project save/load and persistence
- Mobile-friendly layout
- Undo/redo
- Layer switching
- DXF export
- PWA offline support

## Getting Started

### Prerequisites

- Node.js 18+ or pnpm
- npm or pnpm package manager

### Installation

```bash
npm install
# or
pnpm install
```

### Development

```bash
npm run dev
# or
pnpm dev
```

Opens at `http://localhost:5173`

### Production Build

```bash
npm run build
# or
pnpm build
```

The build output will be in the `dist/` directory.

## Deployment

This project is optimized for deployment on Vercel. Simply connect your GitHub repository to Vercel and it will automatically build and deploy on every push.

## Technologies Used

- **React** - UI framework
- **Vite** - Build tool and dev server
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Accessible component library
- **React DnD** - Drag and drop functionality
- **Recharts** - Data visualization

## License

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for license information and attributions.
  
