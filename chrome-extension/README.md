# Bamboo Chrome Extension MVP

This folder contains the Chrome extension MVP for tracking job applications from any job application page into Bamboo.

## What the MVP does

1. The user installs the extension in Chrome.
2. The user signs in from the extension popup with their Bamboo account credentials.
3. The extension only injects on pages that look like job listings or application flows.
4. It auto-opens the tracker only when it detects an actual application form; otherwise it stays minimized as the floating 🎋 button.
5. The tracker pre-fills the best detected job title, company, and current URL.
6. Clicking **Applied** sends the application to `POST /api/applications/manual`, which creates a job row and an application row in Bamboo.

## Load locally in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `chrome-extension` folder from this repo.
5. Pin the extension so the user can access the sign-in popup easily.

## Test the MVP locally

1. Start the Next.js app locally or deploy it somewhere reachable by Chrome.
2. If you are testing locally, update `APP_URL` in `background.js` to your local app URL.
3. Open the extension popup and sign in with a Bamboo account.
4. Visit a job application page such as Greenhouse, Ashby, Lever, or Workday.
5. Confirm that job detail pages show only the minimized 🎋 button unless a real application form is present.
6. Confirm that the full tracker opens once the application form step appears, with the detected `Job Title - Company` summary.
7. Submit or finish the application, then click **Applied** in the tracker.
8. Confirm the new application appears on `/applications` in Bamboo.

## Preparing for the Chrome Web Store

Before publishing, make sure you:

- replace the placeholder extension icons and add them to the manifest if needed,
- verify that the production `APP_URL`, `SUPABASE_URL`, and publishable key are correct,
- write a short privacy policy explaining that credentials are exchanged with Bamboo auth and that job page URLs are stored when the user clicks **Applied**,
- record a short demo video or screenshots for the store listing,
- increment the extension version in `manifest.json` for each new submission.

## Chrome Web Store submission flow

1. Create a developer account in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Zip the contents of the `chrome-extension` folder.
3. Create a new item in the dashboard and upload the zip.
4. Add the store listing details:
   - name: Bamboo Job Tracker,
   - short description: Track your job applications from any company site into Bamboo,
   - screenshots of the popup and in-page tracker,
   - support URL pointing to your product site,
   - privacy policy URL.
5. Fill out the permissions disclosure for page access and account sign-in.
6. Submit for review and address any policy feedback from Google.

## Known MVP limitations

- Detection is still heuristic-based, so a few custom career sites may require opening the tracker manually from the floating button.
- Duplicate clicks create duplicate manual application entries today.
- The extension saves only the job title, company, URL, and `applied` status for the initial MVP.
