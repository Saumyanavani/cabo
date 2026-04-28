# Cabo Room

A sleek 2-4 player Cabo web game built with Next.js. The app has a local multi-seat mode by default and a Supabase realtime adapter for hosted room-code play on Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Online rooms

The app uses Supabase's free tier for room state when these environment variables are present:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create the table and realtime publication with `supabase-schema.sql`, then deploy the Next.js app to Vercel with the same environment variables.

## Rule coverage

The game engine lives in `lib/game` and is intentionally UI-agnostic. Tests cover card values, opponent stacking, wrong-stack penalties, and Cabo losing conditions:

```bash
npm test
```
