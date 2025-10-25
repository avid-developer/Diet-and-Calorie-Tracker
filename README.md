# Diet & Calorie Tracker — Quick Start

This is a lightweight browser-only calorie tracker built for the Software Engineering Lab mini-project.

Current features:
- Manage food items (add, edit with pre-filled form, delete)
- Duplicate-name protection with inline feedback
- Confirm-and-undo flows for food and meal deletions
- Log meals with multiple food rows, auto-calculated totals, edit/delete history
- Macro tracking (protein, carbs, fat) carried through foods, meals, and summaries
- Daily + rolling weekly summaries vs. calorie goals with progress visuals, weekly trend chart, macro breakdown modal, and CSV export
- Set daily calorie goal
- Local storage persistence (localStorage)

Run locally (simple):

1. Open `index.html` in a browser (development only).

OR run a tiny static server (recommended):

```bash
# from project root
npx http-server . -p 5173
# or
npx serve . -p 5173
```

Run tests (Node 18+):

```bash
npm test          # storage smoke tests
npm run test:e2e  # Playwright UI tests
npm run test:all  # full suite
```

Future work: macro goal planning, extended accessibility testing, and deeper responsive polish.
