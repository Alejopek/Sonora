# Graph Report - YT_Player  (2026-10-11)

## Corpus Check
- Corpus is ~44,457 words - fits in a single context window. You may not need a graph.

## Summary
- 629 nodes · 1643 edges · 41 communities (20 shown, 21 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 135 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- api.ts
- routes/account.py
- insights.py
- App.tsx
- routes/music.py
- Lume SKILL.md — Awwwards-Quality Frontend Instructions
- Sonora Music Player Project
- tunnel_watcher.py
- sqlalchemy
- package.json
- compilerOptions
- dependencies
- devDependencies
- scaffold.js
- StatisticsPage.tsx
- compilerOptions
- vercel.json
- Sonora Brand Identity (S logo, magenta/pink palette)
- scripts
- player-store.test.ts
- tsconfig.json
- vite.config.ts
- dev.sh
- Album Art Fallback Pattern (cover placeholder for missing artwork)
- Brutalist Raw Power Aesthetic Direction
- Editorial Luxury Aesthetic Direction
- Playful 3D Wonder Aesthetic Direction
- Retro-Futuristic Neon Aesthetic Direction
- Soft Organic Warmth Aesthetic Direction
- Page Transition Overlay Wipe Component
- Scramble Text Effect Component
- Scroll-Triggered Section Reveal (stagger children)
- Mobile Navigation Patterns (Bottom Sheet + Full-Screen Overlay)
- PyJWT 2.10.1
- pnpm-workspace onlyBuiltDependencies: esbuild

## God Nodes (most connected - your core abstractions)
1. `User` - 42 edges
2. `usePlayerStore` - 34 edges
3. `request()` - 31 edges
4. `useAuthStore` - 27 edges
5. `SongRow()` - 26 edges
6. `CoverImage()` - 21 edges
7. `Lume SKILL.md — Awwwards-Quality Frontend Instructions` - 20 edges
8. `Shell()` - 19 edges
9. `lucide-react` - 19 edges
10. `react` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Performance Without Compromise (transform+opacity only)` --semantically_similar_to--> `Sonora Music Player Project`  [INFERRED] [semantically similar]
  .claude/skills/lume/SKILL.md → AGENTS.md
- `Futuristic Precision Aesthetic Direction` --semantically_similar_to--> `Sonora Music Player Project`  [INFERRED] [semantically similar]
  .claude/skills/lume/references/aesthetics.md → AGENTS.md
- `CSS Custom Properties Template` --semantically_similar_to--> `Sonora Music Player Project`  [INFERRED] [semantically similar]
  .claude/skills/lume/references/components.md → AGENTS.md
- `Sonora Docker Compose Service (FastAPI + Frontend)` --references--> `FastAPI 0.115.8`  [INFERRED]
  docker-compose.yml → backend/requirements.txt
- `Sonora SPA Entry (index.html)` --references--> `Sonora Music Player Project`  [INFERRED]
  frontend/index.html → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Lume 7 Aesthetic Directions** — _claude_skills_lume_references_aesthetics_dark_cinematic, _claude_skills_lume_references_aesthetics_playful_3d_wonder, _claude_skills_lume_references_aesthetics_editorial_luxury, _claude_skills_lume_references_aesthetics_brutalist_raw_power, _claude_skills_lume_references_aesthetics_futuristic_precision, _claude_skills_lume_references_aesthetics_soft_organic_warmth, _claude_skills_lume_references_aesthetics_retro_futuristic_neon [EXTRACTED 1.00]
- **Sonora Backend Technology Stack** — backend_requirements_fastapi, backend_requirements_uvicorn, backend_requirements_ytmusicapi, backend_requirements_yt_dlp, backend_requirements_sqlalchemy, backend_requirements_alembic, backend_requirements_pyjwt [EXTRACTED 1.00]
- **Sonora Docker Compose Services (app + db + tunnel + watcher)** — docker_compose_sonora_service, docker_compose_postgres_service, docker_compose_tunnel_service, docker_compose_tunnel_watcher_service [EXTRACTED 1.00]
- **Sonora App Icon Family (all sizes of the S logo icon)** — frontend_public_apple_touch_icon, frontend_public_favicon_96x96, frontend_public_favicon_svg, frontend_public_web_app_manifest_192x192, frontend_public_web_app_manifest_512x512 [INFERRED 0.95]

## Communities (41 total, 21 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.07
Nodes (92): AddToPlaylistModal(), AddToPlaylistModalProps, AlbumCard(), CoverImage(), CoverImageProps, FullPlayer(), Player(), Queue() (+84 more)

### Community 1 - "routes/account.py"
Cohesion: 0.06
Nodes (58): create_token(), current_user(), hash_password(), verify_password(), close_database(), get_session(), initialize_database(), _url() (+50 more)

### Community 2 - "insights.py"
Cohesion: 0.06
Nodes (51): Base, CatalogTrack, DailyMix, DailyMixItem, Favorite, ListeningDaily, ListeningHour, ListeningSession (+43 more)

### Community 3 - "App.tsx"
Cohesion: 0.10
Nodes (34): App(), Shell(), AccountMenu(), AccountMenuProps, avatarExpressions, joinedOn(), AuthModal(), MobileNav (+26 more)

### Community 4 - "routes/music.py"
Cohesion: 0.13
Nodes (23): album_endpoint(), artist_endpoint(), artwork_endpoint(), debug_stream(), _is_artwork_host(), _lrc_lines(), _lrclib_lyrics(), lyrics_endpoint() (+15 more)

### Community 5 - "Lume SKILL.md — Awwwards-Quality Frontend Instructions"
Cohesion: 0.10
Nodes (26): awwwards-frontend (v1.0 original skill name), Lume Skill Changelog, Lume — Award-Winning Frontend Skill, openskills CLI install target (xedyx123/LUME), scaffold.js — Next.js Project Bootstrapper, Dark Cinematic Aesthetic Direction, Card 3D Tilt on Hover Component, Custom Cursor with Lag Effect Component (+18 more)

### Community 6 - "Sonora Music Player Project"
Cohesion: 0.09
Nodes (25): Futuristic Precision Aesthetic Direction, CSS Custom Properties Template, Cloudflare Tunnel URL Extraction (trycloudflare.com), Deploy Sonora GitHub Actions Workflow, frontend/src/services/api.ts — Single HTTP Client, backend/app/routes/music.py — HTTP Contracts & Streaming, Zustand Player Store (global player state source of truth), Sonora Music Player Project (+17 more)

### Community 7 - "tunnel_watcher.py"
Cohesion: 0.19
Nodes (13): docker_request(), get_db_path(), get_github_token(), get_kuma_monitor(), get_latest_tunnel_url(), get_telegram_creds(), log(), main() (+5 more)

### Community 8 - "sqlalchemy"
Cohesion: 0.22
Nodes (7): _add_legacy_metadata(), _base_track_columns(), _columns(), _create_legacy_tables(), _tables(), upgrade(), upgrade()

### Community 9 - "package.json"
Cohesion: 0.13
Nodes (16): name, private, type, version, blobatar, @blobatar/react, clsx, eslint (+8 more)

### Community 10 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowSyntheticDefaultImports, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+8 more)

### Community 11 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, blobatar, @blobatar/react, clsx, framer-motion, lucide-react, @radix-ui/react-dialog, @radix-ui/react-slider (+5 more)

### Community 12 - "devDependencies"
Cohesion: 0.17
Nodes (12): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, @types/react, @types/react-dom, typescript (+4 more)

### Community 13 - "scaffold.js"
Cohesion: 0.18
Nodes (7): cwd, dirs, { execSync }, fs, globalsPath, path, projectPath

### Community 14 - "StatisticsPage.tsx"
Cohesion: 0.36
Nodes (9): ActivityChart(), dateValue(), duration(), RangeName, ranges, StatisticsPage(), TopList(), getStatistics() (+1 more)

### Community 15 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, target, tsBuildInfoFile (+1 more)

### Community 16 - "vercel.json"
Cohesion: 0.20
Nodes (9): framework, root, framework, root, rewrites, $schema, services, backend (+1 more)

### Community 17 - "Sonora Brand Identity (S logo, magenta/pink palette)"
Cohesion: 0.43
Nodes (7): Apple Touch Icon (Sonora S logo), Favicon 96x96 PNG (Sonora S logo), Favicon SVG (Sonora S logo, AI-generated, C2PA signed), Web App Manifest Icon 192x192 (Sonora S logo), Web App Manifest Icon 512x512 (Sonora S logo, high-res), Progressive Web App Icon Set, Sonora Brand Identity (S logo, magenta/pink palette)

### Community 18 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, test

### Community 19 - "player-store.test.ts"
Cohesion: 0.40
Nodes (3): initialState, localStorageData, PlayerStore

## Knowledge Gaps
- **38 isolated node(s):** `clsx`, `eslint`, `@types/react`, `@types/react-dom`, `typescript` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 207 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `User` connect `routes/account.py` to `insights.py`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `User` (e.g. with `create_token()` and `add_item()`) actually correct?**
  _`User` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `clsx`, `eslint`, `@types/react` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06769135227449154 - nodes in this community are weakly interconnected._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Should `routes/account.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05670103092783505 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._