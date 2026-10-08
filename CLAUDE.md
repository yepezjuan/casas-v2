# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CASAS — a route-planning tool for people who visit multiple clients per day for work (e.g. field salespeople). Users add clients with an address and a visit frequency (weekly, bi-weekly or monthly), then pick which clients to see on a given date; the app geocodes the address, and for a given day it calls the Google Routes API to produce an optimized visit order, ETAs, and a Google Maps deep link back to the user's phone.

**Product direction**: this is planned as a mobile-first app intended for real users, not a demo/practice project. Users are expected to operate it from a phone in the field, so views/UI work should be designed and tested for small-screen/touch use first. Treat robustness, error handling, and security expectations accordingly — e.g. flag things like the hardcoded session secret in `server.js` (`"keyboard cat"`) as issues worth fixing before real users are on it, rather than acceptable for a hobby project.

## Commands

- `npm install` — install dependencies
- `npm start` — run the server via nodemon (reads `config/.env`)
- There is no test suite (`npm test` is an unimplemented stub) and no lint config.

### Required env vars (`config/.env`)

- `PORT` — server port
- `DB_STRING` — MongoDB connection URI
- `MAPS_API_KEY` — Google Maps/Routes API key (used by both geocoding and routing)

## Architecture

Standard Express MVC: `routes/` → `controllers/` → `models/`, with `middleware/` for auth/session guarding and file upload, and `utils/` for external API integration (geocoding, routing). Views are server-rendered EJS (`views/`), no client-side framework.

- **Auth**: Passport local strategy (`config/passport.js`) + bcrypt-hashed passwords (`models/User.js`). Sessions are stored in MongoDB via `connect-mongo` (wired in `server.js`). `middleware/auth.js` exports `ensureAuth`/`ensureGuest` route guards.
- **Client scheduling domain** (the core feature): `models/Client.js` (one record per client, with `frequency`, `lat`/`lng`, `userId`; `day` is a legacy weekday field kept on older clients but no longer read or written) and `models/WorkDayList.js` (named groupings of client ids for a specific `date`, formerly `ClientList`). `controllers/clients.js` handles client CRUD; `controllers/workDayList.js` handles the lists and `optimizeList`, which delegates to `utils/routing.js`.
- **Geocoding** (`utils/geocode.js`): converts a client's address to lat/lng via `@googlemaps/google-maps-services-js`, called on client create/update.
- **Routing** (`utils/routing.js`): calls the Google Routes API (`routes.googleapis.com/directions/v2:computeRoutes`) directly via axios (not the same package as geocoding) to get an optimized waypoint order and durations from a fixed `DEPOT` origin, then builds a schedule (arrive/depart times per stop, assuming a fixed `SERVICE_MINUTES` dwell time) and a Google Maps multi-stop deep link.
- **`docs/db-schema.mmd`**: the intended schema, including a not-yet-implemented `SERVICE_VISIT` model for tracking visit history. It flags two known issues in the current models worth knowing before touching them: `userId` is currently `String` on `Client`/`WorkDayList` but should be an `ObjectId` ref to `User`, and `Client.completed` is legacy/unused, slated for removal once `SERVICE_VISIT` ships.

### Legacy code path (mostly removed)

This repo was originally a "100Devs Social Network" (see `package.json` description) with image posts via Cloudinary/Multer. That feature has largely been stripped out already, in favor of the client-scheduling app above:

- `models/Post.js`, `controllers/posts.js`, `routes/posts.js`, `middleware/cloudinary.js`, `middleware/multer.js`, and `views/post.ejs` have all been deleted. `server.js` mounts only `main`, `dashboard`, `clients`, and `workDayList` routers — no posts route exists to mount.
- `views/feed.ejs` is the one leftover: it still renders a grid of `posts[i].image` linking to `/post/:id`, a route that no longer exists. It should be deleted.
- `views/profile.ejs` has no remaining posts-related content — nothing to clean up there.

When working in this area, prefer deleting `views/feed.ejs` over fixing it, unless the user asks to keep the social feed feature.
