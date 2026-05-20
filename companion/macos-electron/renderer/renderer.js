const state = {
  rows: [],
};

const els = {
  baseUrl: document.getElementById("baseUrl"),
  token: document.getElementById("token"),
  verifyToken: document.getElementById("verifyToken"),
  authStatus: document.getElementById("authStatus"),
  capture: document.getElementById("capture"),
  captureStatus: document.getElementById("captureStatus"),
  rawText: document.getElementById("rawText"),
  rowsBody: document.getElementById("rowsBody"),
  send: document.getElementById("send"),
  sendStatus: document.getElementById("sendStatus"),
};

function getBaseUrl() {
  return els.baseUrl.value.trim().replace(/\/$/, "");
}

function getToken() {
  return els.token.value.trim();
}

function renderRows() {
  els.rowsBody.innerHTML = "";
  for (const row of state.rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.type}</td>
      <td>${row.itemName}</td>
      <td>${row.quantity.toLocaleString()}</td>
      <td>${row.price.toLocaleString()} gp</td>
    `;
    els.rowsBody.appendChild(tr);
  }
  els.send.disabled = state.rows.length === 0;
}

els.verifyToken.addEventListener("click", async () => {
  els.authStatus.textContent = "Verifying...";
  try {
    const result = await window.companionApi.verifyToken(getBaseUrl(), getToken());
    const user = result.user || {};
    els.authStatus.textContent = `Connected as ${user.email || user.id}`;
  } catch (error) {
    els.authStatus.textContent = `Failed: ${error.message}`;
  }
});

els.capture.addEventListener("click", async () => {
  els.captureStatus.textContent = "Capturing and parsing...";
  els.sendStatus.textContent = "";
  try {
    const result = await window.companionApi.captureScreenAndParse(getBaseUrl(), getToken());
    state.rows = result.rows || [];
    renderRows();
    els.rawText.textContent = result.rawText || "";
    els.captureStatus.textContent = `Done. Parsed ${state.rows.length} rows (OCR confidence ${Math.round(result.confidence || 0)}).`;
  } catch (error) {
    els.captureStatus.textContent = `Capture failed: ${error.message}`;
  }
});

els.send.addEventListener("click", async () => {
  els.sendStatus.textContent = "Sending...";
  try {
    const result = await window.companionApi.ingestRows(getBaseUrl(), getToken(), state.rows);
    els.sendStatus.textContent = `Imported: buys ${result.createdBuys}, sells matched ${result.matchedSells}, duplicates skipped ${result.skippedDuplicates}, unmatched sells ${result.unmatchedSells}.`;
  } catch (error) {
    els.sendStatus.textContent = `Send failed: ${error.message}`;
  }
});
