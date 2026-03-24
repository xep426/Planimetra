# Planimetra

Yet another 2D floor-plan sketcher -- except it's the one I wanted to use, so I built it (and I needed DXF export functionality).

## Features

- Interactive 2D canvas for drawing floor plans
- Walls, doors, windows, columns, and passages
- Precision measurements and geometry tools
- Advanced editing tools (wall deletion, height editing)
- Project file management and persistence
- Responsive design with mobile-friendly UI
- Undo/redo support
- Layer management
- DXF export for CAD compatibility
- PWA support for offline access

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
  
