# Authentication Explanation

## How Nakama authentication works

Nakama supports multiple auth providers (email, device, social, custom, and more). This project uses:

- **Email auth (registered users):** frontend sends derived email + password, Nakama validates account credentials, then returns JWT access token and refresh token.
- **Device auth (guests):** frontend sends a device ID string, Nakama creates or reuses the linked account and returns tokens.

## The email convention

Users enter only a username in the UI. Internally, frontend derives email as:

```text
username.toLowerCase()@tictactoe.local
```

This hidden convention allows use of Nakama's battle-tested email/password pipeline (including hashing and verification) without requiring real email addresses. Using `.local` ensures these addresses are non-routable and never used for real mail delivery.

## Token types and lifetimes

| Token | Stored in | Default lifetime | Used for |
|---|---|---|---|
| Access token (JWT) | localStorage (`ttt_token`) | 2 hours | API/RPC authorization and WebSocket auth |
| Refresh token | localStorage (`ttt_refresh_token`) | 60 days | Renewing access token |
| Credentials | localStorage (`ttt_username`, `ttt_password`) | Until cleared | Tier-3 fallback re-authentication |

## 3-tier session restore (restoreSession function)

### Tier 1 - Valid access token

- **Condition:** stored token exists and is not expired (checked client-side by decoding JWT exp)
- **Action:** call `client.restoreSession(token, refreshToken)` and return session
- **Network calls:** zero

### Tier 2 - Expired access token, valid refresh token

- **Condition:** access token expired and refresh token exists
- **Action:** call `client.sessionRefresh(sess)`; Nakama validates refresh token and returns fresh access+refresh pair
- **Persistence:** overwrite tokens in localStorage
- **Network calls:** one (`/v2/session/refresh`)

### Tier 3 - Tokens unusable, credentials available

- **Condition:** token restore/refresh failed, but username/password are stored
- **Action:** call login flow (`authenticate/email`) to obtain a new session
- **Persistence:** overwrite session values in localStorage
- **Network calls:** one (`/v2/account/authenticate/email`)

### Tier 4 - Nothing recoverable

- **Condition:** no usable token or no fallback credentials
- **Action:** return `null` and route user to auth screen

## Guest mode design

Guest mode intentionally prioritizes frictionless entry over long-term identity persistence:

- Random device ID generated per guest login
- Device ID is not persisted locally
- Guest account may be created server-side but is not practically recoverable by users
- Frontend calls `mark_guest` RPC right after guest auth
- Server reads metadata in `matchJoin` and tracks guest IDs in `guestUserIds[]`
- Leaderboard writes check guest list before every write
- Leaderboard UI entry is hidden for guest users
- No guest credentials/session are intentionally saved for restore

## Security considerations

- Password hashing is handled by Nakama (bcrypt), not by frontend code.
- Frontend stores plaintext credentials in localStorage for tier-3 convenience restore; this is a usability/security tradeoff.
- Production applications may disable credential persistence and force explicit re-login after token expiration.
- `defaultkey` server key should be replaced in production deployments.
- Core gameplay security remains server-driven because all move validation and outcomes are authoritative on backend.
