/* ================= AhamMaxxing configuration =================

   CLIENT_ID      Your Google OAuth "Web application" client ID.
                  See README → "Connecting Google Sheets" for how to make one.

                  You can reuse the client ID from 33&Me if you prefer — paste
                  it below — but you must then add this app's origins to that
                  client's "Authorised JavaScript origins" in Google Cloud:
                      http://localhost:8123
                      https://<your-github-username>.github.io
                  Client IDs are not secrets (they ship in the page); it is the
                  origin allow-list on Google's side that protects them.

   SPREADSHEET_ID Optional default sheet. Leave it "" and the app offers to
                  create one for you on first connect. Whichever sheet you end
                  up connected to is remembered in this browser.

   Leave CLIENT_ID empty and the app simply runs local-only, with the Google
   section in Setup explaining what is missing.                             */
window.CONFIG = {
  CLIENT_ID: "",
  SPREADSHEET_ID: "",
};
