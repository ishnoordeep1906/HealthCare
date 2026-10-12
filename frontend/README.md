# CareFlow — connected patient and hospital workflows

This updated UI follows the supplied **Workflow and System Functionality** diagram. The patient and hospital workspaces share real application state inside the browser: requests, selected visits, tickets, department settings, notifications, feedback and conversations.

## Open it

1. Extract the entire ZIP.
2. Open `CareFlow_UI/index.html` in your browser.
3. Choose **Patient**, enter a name or alias, and select **Continue on this device**.

No installation is required for the local workflow. Keep every frontend file together. Use sample information: local entry selects a workspace but does not create a secure account.

For reliable synchronization between tabs and better browser feature support, run this inside the extracted folder:

```sh
python -m http.server 8080
```

Then open `http://localhost:8080`. Voice input depends on browser support, microphone permission, and sometimes an internet connection. Text input always remains available.

## Patient workflow

1. **Sign-in / entry:** select a patient workspace. Configured installations can use Firebase email/password sign-in.
2. **Patient workspace:** enter text, dictate with the microphone, or attach a JPG/PNG/WebP photo. Add the requested day, starting-location label and preferences.
3. **Need & urgency review:** confirm the requested services and specialty. The local parser uses service words; optional connected AI can interpret explicit requests. The patient chooses the emergency or non-emergency pathway. The app does not diagnose conditions or perform clinical triage.
4. **Find best visit:** compare required services, estimated travel, waiting and listed fees. Emergency routing lists open facilities with emergency capability, ordered by sample travel time; it is not a substitute for contacting emergency services.
5. **Choose hospital:** pick manually, auto-select the top eligible option, or use the direct-selection button from the patient workspace.
6. **Journey:** start travelling, mark arrival and check in. Check-in creates a queue ticket for the first department. The patient dashboard shows the chosen hospital, care pathway, service availability and queue status.
7. **Care and completion:** hospital staff call the ticket. The patient can then advance through the remaining visit steps, or hospital staff can mark the visit complete.
8. **Follow-up:** rate the visit, save feedback and a personal reminder date, and exchange practical follow-up messages with the hospital workspace.

Availability changes can pause an affected visit. The patient can accept an alternative hospital; the old ticket is cancelled and a new journey starts.

## Hospital workflow

1. Sign out and enter **Hospital authority**, using the hospital selected by the patient. In the local workspace, facility selection is an interface role, not verified authorization.
2. **Hospital dashboard:** review actual local visit counts, requests, patients waiting and patients in care. Change facility, doctor, testing, pharmacy or emergency-intake availability.
3. **Departments:** set availability, base waiting time, time per patient and simultaneous service slots.
4. **Queue management:** check-in generates tickets automatically. Filter by department or search for a patient/ticket. Call the next patient, change staff-assessed priority, complete a visit, or send an in-workspace notification.
5. **Patient requests:** review the care request, see feedback and reply to follow-up conversations.

On localhost, use two tabs on the same origin: enter as a patient in one and hospital authority in the other. Open the second tab independently, or sign out in that tab before choosing the other role. Queue changes are sent through browser storage events. You can also alternate roles in one tab; records remain saved.

## Walk through the full flow

- Patient: request **an orthopedic consultation and an X-ray**, confirm the services and select Meridian Medical Centre.
- Patient: select **Start journey**, then **I’ve arrived · check in**. Note the ticket, such as `C-001`.
- Hospital authority for Meridian: open **Queue management → Orthopedics → Call next**.
- Patient: the dashboard now says **Your turn**. Advance through care and complete the visit.
- Patient: leave feedback and a follow-up message.
- Hospital authority: open **Patient requests** and reply to the conversation.
- To check re-planning, create another active visit and turn off a required service in the hospital dashboard. Review the new option in the patient journey screen.

## What is local and what can connect

| Function | Included behavior |
| --- | --- |
| Patient and hospital navigation | Working roles, forms and separate workspaces |
| Requests, ranking, selection, journeys | Working local state and calculations |
| Queues and department changes | Working local records; same-origin tab synchronization |
| Notifications and conversations | In-workspace records; no email, SMS or external push |
| Feedback and reminders | Saved locally; reminder dates do not schedule external notifications |
| Photo input | Validation, preview and reference filename; image remains in memory |
| Voice input | Browser SpeechRecognition with support/error handling |
| Firebase sign-in | Implemented optional REST connection; requires your Firebase project |
| Connected AI interpretation | Optional server bridge to Gemini; requires configuration and explicit selection |
| Facility database and map | Fictional starter facilities and a schematic map |
| External booking | Not connected; selecting a hospital does not reserve an appointment |

There is no fixed completion-probability claim. Recommendations show how many requested services are listed instead. Travel and fees come from the starter facility data; location labels do not fetch real geographic data. Arrival estimates use the device clock for today or 9:00 AM for tomorrow. Hospital queues and service durations can change these estimates.

Photo contents are not interpreted by local matching. A text description is required. With connected AI, the photo is sent only when the user selects that option, and the result must still be reviewed. Images are not retained in local storage or shared with the hospital screen; only their filenames are kept as request references.

## Optional Firebase and Gemini connection

See `docs/INTEGRATION.md`. `config.js` has empty connection values by default. The included `backend/server.py` provides Firebase token/role verification and Gemini request interpretation. It does **not** move local visit records into a remote database. Hospital access to a production system still requires server-side authorization for every read and mutation.

No credentials or API keys are supplied. Never add a Gemini secret or a service-account file to browser code.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App entry point |
| `styles.css`, `workflow.css` | Design, components, responsive layouts and print styles |
| `app.js` | Screens, navigation, forms, voice/photo input and interactions |
| `data.js` | Service matching, rankings, travel and timeline calculations |
| `workflow.js` | Patient/hospital state transitions, queues and follow-up |
| `providers.js`, `config.js` | Optional connected services |
| `backend/` | Optional Firebase/Gemini bridge |
| `tests/` | Planning, workflow and application-logic checks |
| `docs/INTEGRATION.md` | Setup, connection boundaries and official references |

## Validation

Run `node --test tests/*.test.cjs`. JavaScript syntax and Python compilation are also checked for this package. Application smoke checks use a small DOM stand-in and do not verify browser rendering. Browser visual testing, microphone interaction, and authenticated cloud calls were unavailable in the build environment; test these with your own browser and configured accounts.

This is a frontend project with local workflow state, not a production medical-record system. Browser storage is not confidential storage, and local role selection is not authentication. Do not use real patient records in the unconnected workspace.
