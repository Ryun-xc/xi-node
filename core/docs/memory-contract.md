# Memory Contract

Four things are separate:

```text
event        what happened
record       what the runtime decided to remember
belief       what the runtime currently thinks is true
review       whether a human accepted an interpretation
```

## Rules

```text
1. Events are append-only.
2. A record points back to evidence.
3. inferred / unresolved records require review.
4. Approving a record does not rewrite its provenance.
5. Retraction keeps a tombstone; it does not silently erase history.
6. Export must be possible without a model.
```

## Record shape

```json
{
  "id": "mem_...",
  "kind": "episodic",
  "scope": "private:1",
  "text": "user mentioned a trip",
  "provenance": {
    "source": "user_message",
    "epistemic": "observed",
    "confidence": 0.9,
    "evidence": ["evt_..."]
  },
  "status": "active",
  "review": { "required": false, "by": null, "at": null }
}
```

## Non-goal

`xi-core/memory` does not decide truth. It records evidence and lets a human or
policy decide what may be recalled.