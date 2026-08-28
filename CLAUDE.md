# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CASAS — a route-planning tool for people who visit multiple clients per day for work (e.g. field salespeople). Users add clients with an address and an assigned day of the week; the app geocodes the address, and for a given day it calls the Google Routes API to produce an optimized visit order, ETAs, and a Google Maps deep link back to the user's phone.

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
- **Client scheduling domain** (the core feature): `models/Client.js` (one record per client, with `day`, `lat`/`lng`, `userId`) and `models/ClientList.js` (named groupings of client ids). `controllers/clients.js` handles CRUD plus `getRoute`, which delegates to `utils/routing.js`.
- **Geocoding** (`utils/geocode.js`): converts a client's address to lat/lng via `@googlemaps/google-maps-services-js`, called on client create/update.
- **Routing** (`utils/routing.js`): calls the Google Routes API (`routes.googleapis.com/directions/v2:computeRoutes`) directly via axios (not the same package as geocoding) to get an optimized waypoint order and durations from a fixed `DEPOT` origin, then builds a schedule (arrive/depart times per stop, assuming a fixed `SERVICE_MINUTES` dwell time) and a Google Maps multi-stop deep link.
- **`docs/db-schema.mmd`**: the intended schema, including a not-yet-implemented `SERVICE_VISIT` model for tracking visit history. It flags two known issues in the current models worth knowing before touching them: `userId` is currently `String` on `Client`/`ClientList` but should be an `ObjectId` ref to `User`, and `Client.completed` is legacy/unused, slated for removal once `SERVICE_VISIT` ships.

### Legacy code path (mid-removal)

This repo was originally a "100Devs Social Network" (see `package.json` description) with image posts via Cloudinary/Multer. That feature is being stripped out in favor of the client-scheduling app above:

- `models/Post.js` has already been deleted, but `controllers/posts.js` and `routes/posts.js` still reference it and will throw if hit.
- `routes/posts.js` is no longer mounted in `server.js` (only `main`, `dashboard`, and `clients` routers are), so the dead code is currently unreachable rather than broken in production — but it should be deleted rather than repaired.
- `middleware/cloudinary.js` and `middleware/multer.js` exist only to support this legacy post-upload flow.
- `views/feed.ejs`, `views/post.ejs`, and the posts-related parts of `views/profile.ejs` belong to the same legacy flow.

When working in this area, prefer deleting the dead code over fixing it, unless the user asks to keep the social feed feature.
