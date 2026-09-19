# Spotify search with Deezer exploration

Set these server environment variables in `.env.local` and restart Next.js:

```dotenv
SPOTIFY_CLIENT_ID=your_spotify_app_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_app_client_secret
SPOTIFY_MARKET=US
```

Create or use an app at https://developer.spotify.com/dashboard. Spotify currently requires the owner of a development-mode app to have Premium. `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`, used by playlist export, can also supply the client ID. The secret must never use the `NEXT_PUBLIC_` prefix. Catalogue search uses client credentials; visitors do not need to sign in.

Artist suggestions retain Spotify's order. Missing credentials, empty responses, rate limits, or Spotify failures fall back to Deezer search. Spotify results show attribution and an external link for the active result; they do not display Deezer fan counts.

On selection, the server fetches the canonical Spotify artist and searches their recordings. It compares up to three distinct ISRCs with Deezer and checks the primary artist name. Only a single consistent Deezer identity is accepted. The graph receives Deezer metadata and IDs. Ambiguous, absent, or failed matches offer a direct Deezer search instead of guessing. Some legitimate artists cannot be mapped when catalogue coverage, spelling, or recording metadata differ.

Tokens and confirmed mappings are cached in server memory; Spotify rate-limit cooldowns honor Retry-After. No credentials are sent to the browser. This is independent of the existing playlist-export sign-in flow.

Verification without credentials uses mocked API responses. To verify live, configure the credentials, search for a common name, check `/api/search` returns `source: "spotify"`, and select a result. `/api/search/resolve` should return a numeric Deezer artist ID; a 422 indicates an unconfirmed match.
