# Notes

## What changed

- Strengthened the backend copy engine to apply copy ratio, BUY/SELL slippage, exchange step-size rounding, allowed-symbol checks, leverage checks, max-notional checks, available-margin checks, and clear rejection reasons.
- Added follower names and simulation summary totals to the API response.
- Improved `/api/simulate-copy` validation errors so invalid fields are returned explicitly.
- Updated the React UI to show follower names, accepted/rejected outcomes, rejection reasons, summary totals, validation feedback, and slippage/leverage risk context.
- Added backend tests for trading behavior, including notional limits and summary totals.

## Assumptions

- Copied orders use the leader trade leverage when it is within the follower's `maxLeverage`; otherwise the order is rejected.
- Slippage is fixed at 15 bps for the simulator endpoint.
- Exchange step sizes are the static values in `backend/src/copyEngine.ts`.
- Summary totals count accepted orders only for notional and margin.

## What I would improve next

- Move symbol metadata, slippage settings, and follower risk settings into configurable data instead of hard-coded fixtures.
- Add API integration tests around `/api/simulate-copy` validation and response shape.
- Track reserved margin per follower across multiple copied orders in a session.
- Add UI controls for slippage and scenario presets if product wants richer simulation coverage.
