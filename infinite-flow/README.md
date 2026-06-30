# Infinite Flow Prototype

Standalone browser prototype for an original infinite-flow game.

## What This Proves

The first slice proves one loop:

1. Stand in the main-god space.
2. Enter `妖塔一层`.
3. Fail or suffer when forcing through the fog demon event.
4. Return to the main-god space.
5. Buy `雷火符` or learn `吐纳诀`.
6. Re-enter the same dungeon event and see a new outcome.

The existing top-level `game/` Cocos project is intentionally untouched.

## Commands

```bash
npm install
npm run dev
npm test -- --run
npm run typecheck
npm run build
```

## First Slice Scope

- Browser-first TypeScript app.
- No backend.
- No payment.
- No account persistence.
- No engine migration.
- Event choices stand in for combat.
