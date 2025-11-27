// popup.js

document.addEventListener("DOMContentLoaded", () => {
    const statusEl = document.getElementById("status");
    const findingsContainer = document.getElementById("findings");
    const urlEl = document.getElementById("page-url");
    const refreshBtn = document.getElementById("refresh-btn");

    const typeLabels = {
        confirm_shaming: "Confirm-shaming / guilt",
        obscured_interface: "Obscured interface / forced modal",
        preselected_opt_in: "Pre-selected opt-in",
        trick_question: "Trick question",
        countdown_timer: "Countdown / fake urgency",
        disguised_ad: "Disguised ad / sponsored content",
    };

    function setStatus(text) {
        if (!statusEl) return;
        statusEl.textContent = text;
        statusEl.style.display = "block";
    }

    function clearStatus() {
        if (!statusEl) return;
        statusEl.textContent = "";
        statusEl.style.display = "none";
    }

    function createSeverityBadge(severity) {
        const span = document.createElement("span");
        span.textContent = severity || "unknown";
        span.style.padding = "2px 6px";
        span.style.borderRadius = "999px";
        span.style.fontSize = "10px";
        span.style.textTransform = "uppercase";

        switch (severity) {
            case "high":
                span.style.backgroundColor = "#ff4d4f";
                span.style.color = "#fff";
                break;
            case "medium":
                span.style.backgroundColor = "#faad14";
                span.style.color = "#000";
                break;
            case "low":
                span.style.backgroundColor = "#52c41a";
                span.style.color = "#000";
                break;
            default:
                span.style.backgroundColor = "#d9d9d9";
                span.style.color = "#000";
                break;
        }

        return span;
    }

    function renderFindings(findings, url) {
        if (urlEl) {
            urlEl.textContent = url || "";
        }

        findingsContainer.innerHTML = "";

        if (!findings || findings.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No obvious dark patterns detected on this page.";
            empty.style.fontSize = "12px";
            empty.style.opacity = "0.7";
            findingsContainer.appendChild(empty);
            return;
        }

        // Group by type
        const grouped = findings.reduce((acc, f) => {
            const type = f.type || "unknown";
            if (!acc[type]) acc[type] = [];
            acc[type].push(f);
            return acc;
        }, {});

        Object.keys(grouped).forEach((typeKey) => {
            const group = grouped[typeKey];

            // Group header
            const groupEl = document.createElement("div");
            groupEl.style.marginBottom = "8px";

            const headerRow = document.createElement("div");
            headerRow.style.display = "flex";
            headerRow.style.justifyContent = "space-between";
            headerRow.style.alignItems = "center";
            headerRow.style.marginBottom = "4px";

            const title = document.createElement("div");
            title.textContent = `${typeLabels[typeKey] || typeKey} (${group.length})`;
            title.style.fontWeight = "600";
            title.style.fontSize = "12px";

            headerRow.appendChild(title);
            groupEl.appendChild(headerRow);

            // Entries
            group.forEach((f) => {
                const item = document.createElement("div");
                item.style.border = "1px solid #eee";
                item.style.borderRadius = "4px";
                item.style.padding = "6px 8px";
                item.style.marginBottom = "4px";
                item.style.backgroundColor = "#fafafa";
                item.style.fontSize = "11px";

                // Top row: severity + id
                const topRow = document.createElement("div");
                topRow.style.display = "flex";
                topRow.style.justifyContent = "space-between";
                topRow.style.alignItems = "center";
                topRow.style.marginBottom = "4px";

                const severityBadge = createSeverityBadge(f.severity);
                topRow.appendChild(severityBadge);

                const idEl = document.createElement("span");
                idEl.textContent = f.id || "";
                idEl.style.opacity = "0.5";
                idEl.style.fontSize = "9px";
                idEl.style.marginLeft = "8px";

                topRow.appendChild(idEl);
                item.appendChild(topRow);

                // Description
                const desc = document.createElement("div");
                desc.textContent = f.description || "(no description)";
                desc.style.marginBottom = "4px";
                item.appendChild(desc);

                // Meta (if any)
                if (f.meta && typeof f.meta === "object") {
                    const metaEl = document.createElement("pre");
                    metaEl.textContent = JSON.stringify(f.meta, null, 2);
                    metaEl.style.backgroundColor = "#fff";
                    metaEl.style.borderRadius = "4px";
                    metaEl.style.padding = "4px";
                    metaEl.style.fontSize = "10px";
                    metaEl.style.overflowX = "auto";
                    item.appendChild(metaEl);
                }

                // Small hint
                const hint = document.createElement("div");
                hint.textContent = "Click the item in the panel on the page to highlight it.";
                hint.style.fontSize = "9px";
                hint.style.opacity = "0.6";
                item.appendChild(hint);

                groupEl.appendChild(item);
            });

            findingsContainer.appendChild(groupEl);
        });
    }

    function requestFindings() {
        setStatus("Scanning page…");

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.id) {
                setStatus("No active tab.");
                return;
            }

            chrome.tabs.sendMessage(
                tab.id,
                { type: "darkPatterns:getFindings" },
                (response) => {
                    if (chrome.runtime.lastError) {
                        setStatus(
                            "Could not reach content script. Is the extension allowed on this page?"
                        );
                        console.warn(chrome.runtime.lastError.message);
                        return;
                    }

                    clearStatus();

                    if (!response) {
                        setStatus("No response from content script.");
                        return;
                    }

                    const { findings, url } = response;
                    renderFindings(findings || [], url || tab.url || "");
                }
            );
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            requestFindings();
        });
    }

    // Initial load
    requestFindings();
});
