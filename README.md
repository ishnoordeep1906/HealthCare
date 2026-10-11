# CareFlow UI

A self-contained, responsive frontend for the CareFlow healthcare journey concept in the supplied presentation and UI specification. The design uses navy, teal, soft green and off-white, with a patient workspace and a hospital demo dashboard.

## Open the app

1. Extract the ZIP completely.
2. Open `CareFlow_UI/index.html` in a current Chrome, Edge, Firefox or Safari browser.
3. Start with the example consultation and X-ray request.

No installation, API keys, build command or internet connection is required. Keep `index.html`, `styles.css`, `data.js`, `app.js` and `assets` together. JavaScript must be enabled. Browsers may restrict local storage for files opened from disk; the demo still works for the current session.

If you prefer serving it locally, run `python3 -m http.server 8080` inside this folder and open `http://localhost:8080`.

## Demo walkthrough

1. **Overview:** enter a care request, choose a day and planning preference, and click **Find my best visit**.
2. **Recommendation:** review the required services, travel, wait, sample fees and explanation. The default balanced example recommends Meridian Medical Centre (facility C).
3. **Compare facilities:** filter to complete visits, sort by time or cost, and switch between list and illustrative map views. Select map pins to review facilities.
4. **My visit plan:** choose a facility, then advance the demo through departure, arrival, consultation, testing and completion. Save the plan on this device or print it.
5. **Re-planning:** before completing the visit, click **Simulate a change**. The default scenario removes X-ray availability at facility C. Review and accept the recommended alternative at Northstar (D). Accepting starts a new demo timeline.
6. **Hospital dashboard:** choose a fictional facility, change doctor/test availability or the waiting-time slider, and apply the update. Recommendations respond to the change.
7. **Updates and preferences:** review activity, mark updates read, change the display name/location, reduce motion, or clear saved data.

Use **Demo controls → Reset the scenario** to start over. **Load the example journey** restores the initial facilities and request while retaining completed-visit history. **Reset the scenario** clears that history as well.

## Included screens

| Screen | Purpose |
| --- | --- |
| Overview | Conversational care request, categories, location, day and preference |
| Understanding your care | Animated summary of the rule-based matching steps |
| Your best visit | Suggested facility and arrival, metrics and explanation |
| Compare facilities | Complete-visit filter, sorting, facility cards and schematic map |
| My visit plan | Visit timeline, progress, printing and local save |
| Re-planning dialog | Service disruption, alternative comparison and acceptance |
| Updates | Demo events, unread state and dismiss controls |
| Hospital dashboard | Sample queues, charts and availability controls |
| Preferences | Local profile, planning preference and reduced motion |

## What the data means

- All facilities, queue entries, availability, fees and percentages are fictional demonstration data. Completion percentages are fixed illustrative values, not calibrated medical or operational predictions.
- The map is a hand-built schematic. It is not geographic navigation, and changing the location label does not retrieve nearby hospitals.
- The request parser recognizes supported service and specialty words. It does not diagnose symptoms, assess urgency or use an AI API.
- The suggested arrival is fixed at **1:20 PM** for a repeatable demonstration. Today/Tomorrow changes the visit label. No current date, opening-hours or capacity check occurs.
- Cost means the sum of requested sample service fees in Indian rupees; it excludes travel costs.
- The displayed waiting metric is the initial facility queue. Total visit time also includes one-way travel, consultation, test transfer/wait and test duration, and pharmacy collection when requested. It excludes the return journey.
- Ineligible facilities are excluded from recommendations. Balanced ranking combines total time, sample cost and the illustrative completion value. Shorter-wait and lower-cost preferences change the ranking. See `data.js` for the exact formulas.
- No appointment is booked, no message is sent, and no hospital system is contacted.
- Saving a plan or preferences stores a snapshot in this browser under `careflow-ui-v1`. Unsaved changes and the updates feed are session-only. This is not a secure patient-record system.

## Files and customization

| File | Edit here to change |
| --- | --- |
| `index.html` | App shell, navigation and page metadata |
| `styles.css` | Colors, typography, components, responsive layouts and print styles |
| `data.js` | Sample facilities, service matching, eligibility, ranking and timeline |
| `app.js` | Screens, forms, routing, dialogs and demo interactions |
| `assets/favicon.svg` | App icon |
| `docs/INTEGRATION.md` | Boundaries for connecting a future backend |
| `tests/model.test.cjs` | Planning-logic checks, using Node's built-in test runner |

This version uses plain HTML, CSS and JavaScript to make the ZIP directly runnable. React, FastAPI, SQLite, TomTom, Firebase, Gemini and TinyFish are not installed or connected. The frontend is structured around a separate planning model to make later integration straightforward.

## Validation

Run `node --test tests/model.test.cjs` for the deterministic model checks. Run `node --check app.js` and `node --check data.js` for JavaScript syntax checks.

The delivery was checked for model behavior, JavaScript syntax, local asset references and CSS structure. Browser visual and end-to-end interaction testing was unavailable in the build environment. Before production use, verify the layout and keyboard interactions in the browsers and device sizes you intend to support.

Accessibility provisions include labelled form controls, semantic navigation, a skip link, visible focus styles, native dialogs, text status labels, reduced-motion support and a polite status region. These provisions do not constitute an accessibility audit.
