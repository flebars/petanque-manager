# AGENTS.md - Petanque Manager

## Project Overview

Petanque tournament management application for the French Petanque federation (FFPJP).
Full specification in French: `Specifications.MD`.

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Zustand + TailwindCSS + react-pdf |
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
npm run build
npm run start:dev
npm run lint
npm run test                              # all unit tests
npm run test -- --testPathPattern=draw   # single file by pattern
npm run test -- --testNamePattern="draw algorithm"  # single test by name
npm run test:e2e

# Frontend (React + Vitest or Jest)
cd frontend
npm install
npm run build
npm run dev
npm run lint
npm run typecheck
npm run test
npm run test -- --watch
npm run test -- TournamentCard.test.tsx  # single test file
```

> Commands will be confirmed once the project is scaffolded. The patterns above
> follow NestJS (Jest) and Vite (Vitest) defaults.

---

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── tournaments/
│   │   │   ├── teams/
│   │   │   ├── players/
│   │   │   ├── matches/
│   │   │   ├── draw/        # pure service, no side-effects — exhaustively tested
│   │   │   └── scoring/
│   │   ├── common/          # guards, filters, decorators, pipes
│   │   └── prisma/
│   └── test/                # e2e tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/          # Zustand stores
│   │   ├── hooks/
│   │   ├── api/             # REST client functions
│   │   └── types/
│   └── __tests__/
└── docker-compose.yml
```

---

## Code Style Guidelines

### General Principles

- **No comments** unless explicitly requested
- **TypeScript strict mode** everywhere
- **ESLint + Prettier** enforced — run lint/typecheck before every commit
- **Feature-based** folder structure (each module owns its types, service, controller, tests)
- No business logic in the frontend — all rules (scoring, draw, ranking) live in the backend

### Formatting

- 2-space indentation
- Single quotes for strings
- Trailing commas
- Semicolons required
- Max line length: 100 characters

### Imports

```typescript
// Order: external → internal (@/) → relative
import { Injectable } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { CreateTournamentDto } from './dto/create-tournament.dto'
```

### Types

```typescript
// Interfaces for data shapes; types for unions/aliases
interface Team {
  id: string;
  name: string;
  players: Player[];
}

type TournamentStatus = 'draft' | 'registration' | 'in_progress' | 'completed';

// Explicit return types on all functions
function calculateQuotient(scored: number, conceded: number): number {
  return conceded === 0 ? scored : scored / conceded;
}
```

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Files (components) | PascalCase | `TournamentCard.tsx` |
| Files (utils/hooks) | camelCase | `useTournament.ts` |
| Functions/methods | camelCase | `getTeamsByScore()` |
| Components | PascalCase | `<TeamList />` |
| Constants | UPPER_SNAKE_CASE | `MAX_PLAYERS = 3` |
| Interfaces | PascalCase | `interface Match {}` |
| Enums | PascalCase | `TournamentFormat.Melee` |
| Database tables | snake_case | `tournament_teams` |
| Prisma models | PascalCase singular | `model Concours {}` |

### Error Handling

```typescript
// Backend: NestJS built-in HTTP exceptions
throw new NotFoundException(`Team ${id} not found`);
throw new BadRequestException('Score must be exactly 13 for the winner');
throw new ConflictException('Team has already played this opponent in round 2');

// Frontend: React Query + toast
const { data, error, isError } = useQuery(...);
if (isError) toast.error(error.message);
```

### API Design (NestJS)

```typescript
@Controller('tournaments')
export class TournamentController {
  @Get()         findAll(): Promise<Tournament[]>
  @Get(':id')    findOne(@Param('id') id: string): Promise<Tournament>
  @Post()        create(@Body() dto: CreateTournamentDto): Promise<Tournament>
  @Patch(':id')  update(@Param('id') id: string, @Body() dto: UpdateTournamentDto)
  @Delete(':id') remove(@Param('id') id: string)
}
```

### Database (Prisma)

```prisma
model Concours {
  id        String            @id @default(uuid())
  nom       String
  format    ConcourFormat
  statut    ConcourStatut
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  equipes   Equipe[]
  parties   Partie[]
}
```

Key DB constraints (must be preserved in migrations):
- `parties`: unique composite `(concours_id, tour, equipe_a_id, equipe_b_id)`
- `classements`: implemented as materialized view, refreshed after each score validation
- `tirages_log`: stores random seed + active constraints + pairings for traceability

### State Management (Zustand)

```typescript
// stores/tournamentStore.ts
interface TournamentStore {
  current: Tournament | null;
  setCurrent: (t: Tournament) => void;
}

export const useTournamentStore = create<TournamentStore>((set) => ({
  current: null,
  setCurrent: (t) => set({ current: t }),
}));
```

### React Components

```typescript
interface MatchCardProps {
  match: Match;
  onScoreSubmit?: (matchId: string, scoreA: number, scoreB: number) => void;
}

export function MatchCard({ match, onScoreSubmit }: MatchCardProps) {
  return <Card>...</Card>;
}
```

### Git Conventions

- Branch: `feature/tournament-scoring`, `fix/draw-bye-calculation`
- Commits: imperative mood, ≤50 chars subject line
- Never commit without passing lint + typecheck

---

## Key Business Rules

1. **Score**: winner must have exactly 13 points; both scores always recorded (e.g. 13-7)
2. **Team sizes**: Tête-à-tête=1, Doublette=2, Triplette=3 players
3. **Tournament formats**: Mêlée (Swiss rounds), Coupe (elimination ± consolante), Championnat (pools → bracket)
4. **Team constitution modes**:
   - *Mêlée-Démêlée*: individual signup, random teams each round (Mêlée format only)
   - *Mêlée*: individual signup, random teams formed once at start
   - *Montée*: pre-formed teams register as a unit
5. **Ranking priority** (both for pool standings and final Mêlée ranking):
   1. Wins
   2. Point quotient (`points_scored / points_conceded`)
   3. Points scored
   4. Random draw as final tiebreaker
6. **Draw algorithm** (Mêlée rounds): group by wins → random pairings within group → avoid rematches → bye (13-0) if odd count → optional: avoid same-club matches early
7. **Forfeit**: pre-match forfeit = 13-0 to opponent; mid-match forfeit = score frozen at current value
8. **Redis draw lock**: use `SETNX` to prevent concurrent draw triggers on the same round

---

## User Roles

| Role | Permissions |
|------|------------|
| Super Admin | Global settings, licence management |
| Organisateur | Create/manage tournaments |
| Arbitre | Score entry/validation, dispute resolution |
| Capitaine | Read + submit own team scores |
| Spectateur | Read-only public results |

---

## UI / Design System

- **Default theme**: dark mode (`#0F1923` background, `#1C2B38` card surfaces)
- **Primary**: deep blue `#1E3A5F` / `#2D6CDF`
- **Success/win**: emerald `#1A7A4A` / `#2ECC71`
- **Alert/active**: orange `#E07B20` / `#F39C12`
- **Text**: `#E8EDF2` (primary), `#7A9BB5` (secondary)
- **Fonts**: Inter (UI text) + Barlow Condensed Bold (scores, rankings, terrain numbers)
- **Score display**: minimum 48px for TV-visible screens
- **Contrast**: WCAG AA (4.5:1 for body text, 3:1 for large text/graphics)
- **Breakpoints**: mobile <768px, tablet 768–1280px, desktop >1280px
