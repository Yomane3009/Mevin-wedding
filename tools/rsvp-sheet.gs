// Google Apps Script that stores RSVP replies from the site in a Google Sheet
// (File > Download > Microsoft Excel gives an .xlsx copy at any time).
//
// Setup, once:
// 1. Create a Google Sheet, then open Extensions > Apps Script.
// 2. Replace the code there with this file and save.
// 3. Deploy > New deployment > type "Web app".
//    Execute as: Me. Who has access: Anyone. Deploy and allow access.
// 4. Copy the web app URL (it ends in /exec) into data-endpoint on #rsvp in index.html.

const HEADERS = ["Received", "Name", "Coming to", "Guests", "Note"];

function doPost(e) {
  const p = (e && e.parameter) || {};
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getSheetByName("RSVPs") || book.insertSheet("RSVPs");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  sheet.appendRow([
    new Date(),
    clean(p.name, 80),
    clean(p.attending, 40),
    clean(p.guests, 4),
    clean(p.message, 500),
  ]);
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Trim and shorten what guests type, and stop text such as "=SUM(...)" from
// being run as a spreadsheet formula
function clean(value, max) {
  const text = String(value || "").trim().slice(0, max);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}
