# Use a bounded Stop Hook gate

Agent Bridge uses only the producer agent's Stop Hook as the completion boundary, then waits up to five minutes for consumer agents. A consumer failure inside that window fails fast and is returned to the producer; if the window expires, the producer is released while consumers continue in the service process and late results are recorded in status rather than injected back into the producer session.

**Considered Options**

- Wait for all consumers indefinitely. This preserves the strongest gate, but it can make the producer session feel frozen when a consumer CLI hangs, asks for auth, or takes too long.
- Release immediately and always review asynchronously. This avoids blocking, but removes the useful ability to synchronously catch clear failures before the producer finishes.
- Use a bounded gate. This keeps synchronous feedback when it arrives quickly enough while making "do not trap the producer" the higher priority.

**Consequences**

Timed-out bridge runs are not passes. They are visible as timed out or late results in `agent-bridge status`; late failures do not automatically recall or interrupt the producer session.
