# Config Schema

The Local Preference File stores only non-sensitive preferences.

Default path:

```text
config.local.json
```

Do not store:

- Account name.
- Password.
- Cookies.
- JWTs.
- Browser localStorage.
- Payment data.
- Login session data.

## Example

```json
{
  "fallback_farming_target": {
    "name": "侵蚀隧洞：幽冥之径",
    "run_count": 4,
    "confirmed_at": "2026-06-15"
  },
  "browser": {
    "viewport": {
      "width": 2048,
      "height": 1152
    }
  },
  "checkpoints": {
    "profile": "default"
  }
}
```

## Fields

- `fallback_farming_target.name`: user-visible farming target name.
- `fallback_farming_target.run_count`: requested Run Count.
- `fallback_farming_target.confirmed_at`: date when the user last confirmed the preference.
- `browser.viewport.width`: preferred browser viewport width.
- `browser.viewport.height`: preferred browser viewport height.
- `checkpoints.profile`: checkpoint calibration profile name.

## Update Rules

- Ask before overwriting `fallback_farming_target`.
- Clamp `run_count` to a positive integer.
- Use default Run Count `4` when the user does not specify a count.
- Never infer or persist sensitive account state.
