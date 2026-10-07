# ShoppingRoute product principle

User instruction from Frank, 2026-10-07: Mobile comfort comes first. Design from the shopper using a phone in the store. The ioBroker adapter implements that comfort, rather than making shoppers adapt to server/admin workflows.

- Lists created by the UI must exist in Alexa and be usable on the phone. Local configuration alone is not successful creation.
- Allow adding shopping items directly in the shopping-list view, including an empty list.
- Use readable feedback, large touch targets, responsive layouts and few steps. Do not require a mouse, keyboard or adapter restart for routine shopping actions.
- Confirm external operations before reporting success. Preserve unsaved input on failure and prevent duplicate submissions.
- A missing list binding must not stop unrelated healthy lists. Keep safeguards for actual uncertain/failed writes.
