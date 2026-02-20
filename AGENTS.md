# AGENTS.md - Petanque Manager

## Project Overview

Petanque tournament management application for the French Petanque federation (FFPJP).
Full specification in French: `Specifications.MD`.

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19 + Zustand + TailwindCSS v4 + react-hook-form + Zod |
| Backend API | Node.js + NestJS |
| Database | PostgreSQL (Prisma ORM) |
| Cache/Sessions | Redis (JWT refresh tokens + distributed draw lock via SETNX) |
| Real-time | Socket.io (WebSocket) |
| Auth | JWT + Refresh Token (roles encoded in token) |
| PDF (server) | pdfkit |
| Containerization | Docker + docker-compose |
| Hosting | Railway + Nginx reverse proxy |

---

## Build / Lint / Test Commands

```bash
# Backend (NestJS + Jest)
cd backend
npm install
npm run build                                          # tsc -p tsconfig.build.json
npm run start:dev                                      # ts-node-dev with path aliases
npm run lint                                           # eslint --fix
npm run test                                           # jest (all *.spec.ts under src/)
npm run test -- --testPathPattern=tirage              # single file by path pattern
npm run test -- --testNamePattern="should pair all"   # single test by name
npm run test:watch                                     # jest --watch
npm run test:cov                                       # jest --coverage
npm run test:e2e                                       # jest --config test/jest-e2e.json
npm run prisma:generate                                # regenerate Prisma client
npm run prisma:migrate                                 # run migrations (dev)

# Frontend (React + Vitest)
cd frontend
npm install
npm run build                                          # tsc && vite build
npm run dev                                            # vite dev server on :5173
npm run lint                                           # eslint src --ext .ts,.tsx --fix
npm run typecheck                                      # tsc --noEmit
npm run test                                           # vitest run (single pass)
npm run test:watch                                     # vitest (interactive)
npm run test:ui                                        # vitest --ui
```

Test files: backend uses `*.spec.ts` (Jest); frontend uses `*.test.ts(x)` (Vitest, jsdom env).
Frontend test setup file: `frontend/src/test/setup.ts`.

---

## Project Structure

```
/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── common/          # guards, filters, decorators, pipes
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── classement/
│   │   │   ├── concours/    # tournaments: controller, service, dto/
│   │   │   ├── equipes/     # teams
│   │   │   ├── gateway/     # Socket.io WebSocket gateway
│   │   │   ├── joueurs/     # players
│   │   │   ├── parties/     # matches
│   │   │   ├── pdf/
│   │   │   └── tirage/      # draw algorithm — pure service, exhaustively tested
│   │   ├── prisma/
│   │   └── main.ts
│   └── test/                # e2e tests + jest-e2e.json
├── frontend/
│   └── src/
│       ├── api/             # axios REST client functions (one file per resource)
│       ├── components/      # feature-based: concours/, match/, classement/, common/, layout/
│       ├── hooks/
│       ├── lib/
│       ├── pages/
│       ├── stores/          # Zustand stores: authStore.ts, concoursStore.ts
│       ├── test/            # setup.ts
│       └── types/
└── docker-compose.yml
```

---

## Code Style Guidelines

### General Principles

- **No comments** unless explicitly requested
- **TypeScript strict mode** everywhere (`strict: true`, `noImplicitAny`, `noUnusedLocals/Parameters`)
- **ESLint + Prettier** enforced — run lint and typecheck before every commit
- **Feature-based** folder structure (each module owns its types, service, controller, tests)
- No business logic in the frontend — all rules (scoring, draw, ranking) live in the backend

### Formatting (from `backend/.prettierrc`)

```json
{ "singleQuote": true, "trailingComma": "all", "semi": true, "printWidth": 100, "tabWidth": 2 }
```

- 2-space indentation, single quotes, trailing commas, semicolons required, max 100 chars

### Imports

```typescript
// Order: external → internal (@/) → relative
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateConcoursDto } from './dto/create-concours.dto';
```

Path alias `@/` maps to `src/` in both backend and frontend (`tsconfig.json` paths + moduleNameMapper in Jest).

### Types

```typescript
// Interfaces for data shapes; type aliases for unions/mapped types
interface EquipeInfo {
  id: string;
  victoires: number;
  club?: string;
  adversairesDejaRencontres: string[];
}

type StatutConcours = 'INSCRIPTION' | 'EN_COURS' | 'TERMINE';

// Explicit return types required on all functions (ESLint rule: error)
function calculateQuotient(scored: number, conceded: number): number {
  return conceded === 0 ? scored : scored / conceded;
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (components) | PascalCase | `TournamentCard.tsx` |
| Files (utils/hooks/api) | camelCase | `useConcours.ts`, `concours.ts` |
| Functions/methods | camelCase | `tirageMelee()`, `findOne()` |
| React components | PascalCase | `<MatchCard />` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS = 3` |
| Interfaces | PascalCase | `interface EquipeInfo {}` |
| Enums (Prisma/TS) | UPPER_SNAKE_CASE values | `FormatConcours.MELEE` |
| Database tables | snake_case | `equipe_joueurs`, `tirages_log` |
| Prisma models | PascalCase singular | `model Concours {}` |
| Domain terms | French | `concours`, `equipe`, `partie`, `joueur`, `tirage` |

### Error Handling

```typescript
// Backend: NestJS built-in HTTP exceptions
throw new NotFoundException(`Concours ${id} introuvable`);
throw new BadRequestException('Impossible de modifier un concours déjà démarré');
throw new ForbiddenException('Accès refusé');
throw new ConflictException('Cette équipe a déjà joué cet adversaire');

// Frontend: TanStack Query + react-hot-toast
const { data, error, isError } = useQuery({ queryKey: [...], queryFn: ... });
if (isError) toast.error(error.message);
```

### API Design (NestJS)

```typescript
@Controller('concours')
@UseGuards(AuthGuard('jwt'))
export class ConcoursController {
  constructor(private concoursService: ConcoursService) {}

  @Get()           findAll(): Promise<Concours[]>
  @Get(':id')      findOne(@Param('id') id: string): Promise<Concours>
  @Post()          create(@Body() dto: CreateConcoursDto, @CurrentUser() user: JwtPayload): Promise<Concours>
  @Patch(':id')    update(@Param('id') id: string, @Body() dto: UpdateConcoursDto): Promise<Concours>
  @Delete(':id')   remove(@Param('id') id: string): Promise<void>
  @Post(':id/demarrer')  demarrer(@Param('id') id: string): Promise<Concours>
}
```

### Database (Prisma)

All domain models use French names matching the spec. Key constraints to preserve:

- `parties`: `@@unique([concoursId, tour, equipeAId, equipeBId])`
- `classements`: `@@unique([concoursId, equipeId])` — refreshed after each score validation
- `tirages_log`: stores `seed` + `contraintes` + `appariements` JSON for traceability
- `terrains`: `@@unique([concoursId, numero])`

### State Management (Zustand)

```typescript
// stores/authStore.ts pattern — use persist middleware when state must survive reload
interface AuthStore {
  accessToken: string | null;
  user: JwtUser | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist((set, get) => ({ ... }), { name: 'auth-store', partialize: (s) => ({ ... }) }),
);
```

### React Components

```typescript
// Props interface directly above the component, no default exports for components
interface MatchCardProps {
  match: Match;
  onScoreSubmit?: (matchId: string, scoreA: number, scoreB: number) => void;
}

export function MatchCard({ match, onScoreSubmit }: MatchCardProps) {
  return <div>...</div>;
}
```

Form validation uses `react-hook-form` + `zod` via `@hookform/resolvers`.

### Testing (Backend — Jest)

Test files are co-located with the module as `*.spec.ts`. The `tirage` module is the most
exhaustively tested — use it as the reference pattern:

```typescript
describe('tirageMelee', () => {
  it('should pair all teams when even count', () => {
    const equipes = [makeEquipe('A', 2), makeEquipe('B', 2)];
    const result = tirageMelee(equipes, 2, 'seed1');
    expect(result.appariements).toHaveLength(1);
  });
});
```

Pure service functions (no DB, no side-effects) are tested directly without NestJS TestingModule.
Use `@nestjs/testing` only for integration tests that require DI.

### Git Conventions

- Branch: `feature/tournament-scoring`, `fix/draw-bye-calculation`
- Commits: imperative mood, ≤50 chars subject line
- Never commit without passing lint + typecheck

---

## Key Business Rules

1. **Score**: winner must have exactly 13 points; both scores always recorded (e.g. 13-7)
2. **Team sizes**: Tête-à-tête=1 (`TETE_A_TETE`), Doublette=2, Triplette=3 players
3. **Tournament formats**: `MELEE` (Swiss rounds), `COUPE` (elimination ± consolante), `CHAMPIONNAT` (pools → bracket)
4. **Constitution modes**: `MELEE_DEMELEE` (random teams each round), `MELEE` (random teams once at start), `MONTEE` (pre-formed)
5. **Ranking priority**: 1) Wins 2) Quotient (`pointsMarques / pointsEncaisses`) 3) Points scored 4) Random tiebreaker
6. **Draw algorithm** (`tirageMelee`): group by wins → random pairings within group → avoid rematches → bye (13-0) if odd → optional `eviterMemeClub`
7. **Forfeit**: pre-match = 13-0 to opponent; mid-match = score frozen
8. **Redis draw lock**: `SETNX` to prevent concurrent draw triggers on the same round

---

## User Roles

| Role | Prisma enum | Permissions |
|------|-------------|------------|
| Super Admin | `SUPER_ADMIN` | Global settings, licence management |
| Organisateur | `ORGANISATEUR` | Create/manage tournaments |
| Arbitre | `ARBITRE` | Score entry/validation, dispute resolution |
| Capitaine | `CAPITAINE` | Read + submit own team scores |
| Spectateur | `SPECTATEUR` | Read-only public results |

---

## UI / Design System

- **Default theme**: dark mode (`#0F1923` background, `#1C2B38` card surfaces)
- **Primary**: deep blue `#1E3A5F` / `#2D6CDF`
- **Success/win**: emerald `#1A7A4A` / `#2ECC71`
- **Alert/active**: orange `#E07B20` / `#F39C12`
- **Text**: `#E8EDF2` (primary), `#7A9BB5` (secondary)
- **Fonts**: Inter (UI text) + Barlow Condensed Bold (scores, rankings, terrain numbers)
- **Score display**: minimum 48px for TV-visible screens
- **Contrast**: WCAG AA (4.5:1 body text, 3:1 large text/graphics)
- **Breakpoints**: mobile <768px, tablet 768–1280px, desktop >1280px
