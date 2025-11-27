(() => {
    if (window.__darkPatternScannerLoaded) return;
    window.__darkPatternScannerLoaded = true;

    // our 6 categories
    const FINDING_TYPES = {
        CONFIRM_SHAMING: "confirm_shaming",
        OBSCURED_INTERFACE: "obscured_interface",
        PRESELECTED_OPT_IN: "preselected_opt_in",
        TRICK_QUESTION: "trick_question",
        COUNTDOWN_TIMER: "countdown_timer",
        DISGUISED_AD: "disguised_ad",
    };

    const MAX_FINDINGS = 128;
    let totalFindingsCount = 0;

    let findingCounter = 0;
    const createFindingId = () => `dp-${Date.now()}-${findingCounter++}`;

    function describeElement(el) {
        if (!el || !el.tagName) return "Unknown element";

        const parts = [el.tagName.toLowerCase()];
        if (el.id) parts.push(`#${el.id}`);
        if (el.classList && el.classList.length) {
            parts.push("." + Array.from(el.classList).slice(0, 3).join("."));
        }
        return parts.join("");
    }

    function highlightElement(el, color = "red") {
        if (!el || el.__darkPatternHighlighted) return;
        el.__darkPatternHighlighted = true;

        el.style.outline = `2px solid ${color}`;
        el.style.outlineOffset = "2px";

        const oldTitle = el.getAttribute("title") || "";
        el.setAttribute(
            "title",
            (oldTitle ? oldTitle + " | " : "") +
            "Possible dark pattern detected by extension"
        );
    }

    /** Text helpers */
    function normalizeText(str) {
        return (str || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
    }

    function elementText(el) {
        return normalizeText(el?.innerText || el?.textContent || "");
    }

    function findClosestTextElement(root, keywords) {
        if (!root || !keywords || !keywords.length) return root;

        const lowerKeywords = keywords.map((k) => k.toLowerCase());

        let bestEl = null;
        let bestLen = Infinity;

        try {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                null
            );

            while (walker.nextNode()) {
                const node = walker.currentNode;
                const textNorm = normalizeText(node.nodeValue);
                if (!textNorm) continue;

                const hasKeyword = lowerKeywords.some((k) => textNorm.includes(k));
                if (!hasKeyword) continue;

                const el = node.parentElement;
                if (!el) continue;

                const len = elementText(el).length;
                if (len && len < bestLen) {
                    bestLen = len;
                    bestEl = el;
                }
            }
        } catch (e) {
            return root;
        }

        return bestEl || root;
    }

    function detectConfirmShaming(root = document) {
        const findings = [];

        const guiltKeywords = [
            "regret",
            "miss out",
            "missing out",
            "fear of missing",
            "you'll be sorry",
            "you will be sorry",
            "don't leave",
            "dont leave",
            "wait, don't go",
            "wait dont go",
            "are you sure",
            "really want to leave",
            "really want to miss",
            "before you go",
        ];

        // Self-sabotaging / obviously bad opt-out statements
        const selfSabotageKeywords = [
            "pay full price",
            "hate saving",
            "hate savings",
            "hate discounts",
            "hate deals",
            "hate money",
            "i don't like saving",
            "i dont like saving",
            "i don't like discounts",
            "i dont like discounts",
            "i don't like deals",
            "i dont like deals",
        ];

        // Phrases often used on opt-out CTAs
        const optOutKeywords = [
            "no thanks",
            "no, thanks",
            "no thank you",
            "no, thank you",
            "no i'm good",
            "no im good",
            "no i am good",
            "i'll pass",
            "ill pass",
        ];

        const allKeywords = [
            ...guiltKeywords,
            ...selfSabotageKeywords,
            ...optOutKeywords,
        ];

        const clickable = root.querySelectorAll(
            "button, a, [role='button'], input[type='button'], input[type='submit']"
        );

        clickable.forEach((el) => {
            const text = elementText(el);
            if (!text) return;

            const hasGuilt = guiltKeywords.some((k) => text.includes(k));
            const hasSelfSabotage = selfSabotageKeywords.some((k) => text.includes(k));
            const hasOptOutPhrase = optOutKeywords.some((k) => text.includes(k));

            const looksLikeShaming =
                (hasOptOutPhrase && (hasGuilt || hasSelfSabotage)) ||
                (hasGuilt && hasSelfSabotage);

            if (!looksLikeShaming) return;

            const targetEl = findClosestTextElement(el, allKeywords);

            findings.push({
                id: createFindingId(),
                type: FINDING_TYPES.CONFIRM_SHAMING,
                severity: "high",
                description: 'Possibly manipulative opt-out copy',
                element: targetEl,
            });

            highlightElement(targetEl, "orange");
        });

        return findings;
    }

    function detectObscuredInterface(root = document) {
        const findings = [];
        const all = root.querySelectorAll("div, section, aside");

        all.forEach((el) => {
            const style = window.getComputedStyle(el);
            const position = style.position;
            const zIndex = parseInt(style.zIndex, 10);
            const width = parseInt(style.width, 10);
            const height = parseInt(style.height, 10);

            const hugeArea =
                width > window.innerWidth * 0.7 && height > window.innerHeight * 0.7;
            const isOverlayLike =
                (position === "fixed" || position === "absolute") &&
                !isNaN(zIndex) &&
                zIndex >= 1000 &&
                hugeArea;

            if (!isOverlayLike) return;

            const buttons = el.querySelectorAll("button, a, [role='button']");
            if (buttons.length === 0) return;

            const description = `Large overlay (${describeElement(
                el
            )}) with high z-index that might block the interface.`;

            findings.push({
                id: createFindingId(),
                type: FINDING_TYPES.OBSCURED_INTERFACE,
                severity: "medium",
                description,
                element: el,
            });

            highlightElement(el, "red");
        });

        return findings;
    }

    function detectPreselectedOptIn(root = document) {
        const findings = [];

        const keywords = [
            "deal",
            "newsletter",
            "newsletters",
            "marketing",
            "offers",
            "promotions",
            "promo",
            "sale alerts",
            "updates",
            "product updates",
            "third party",
            "third-party",
            "partners",
            "share my data",
            "share our data",
            "personalized ads",
        ];

        const checkboxes = root.querySelectorAll("input[type='checkbox'][checked]");
        checkboxes.forEach((input) => {
            let labelText = "";
            if (input.id) {
                const lbl = root.querySelector(`label[for="${CSS.escape(input.id)}"]`);
                if (lbl) labelText = elementText(lbl);
            }
            if (!labelText) {
                const parentLabel = input.closest("label");
                if (parentLabel) labelText = elementText(parentLabel);
            }

            const text = labelText || elementText(input.parentElement);
            const txt = text.toLowerCase();
            const maybeConsent = keywords.some((k) => txt.includes(k));

            if (!maybeConsent) return;

            const targetEl = findClosestTextElement(
                input.closest("label") || input.parentElement || input,
                keywords
            );

            findings.push({
                id: createFindingId(),
                type: FINDING_TYPES.PRESELECTED_OPT_IN,
                severity: "high",
                description: `Pre-checked consent box on ${describeElement(
                    targetEl
                )}`,
                element: targetEl,
            });

            highlightElement(targetEl, "purple");
        });

        return findings;
    }

    function detectTrickQuestions(root = document) {
        const findings = [];

        const confusionKeywords = [
            "uncheck if",
            "un-check if",
            "un check if",
            "check if you don't want",
            "check if you dont want",
            "check if you do not want",
            "do not uncheck",
            "don't uncheck",
            "dont uncheck",
            "opt out",
            "opt-out",
            "optout",
        ];

        const consentContextKeywords = [
            "email",
            "emails",
            "newsletter",
            "newsletters",
            "offers",
            "promotions",
            "marketing",
            "ads",
            "advertising",
            "news and updates",
            "updates",
        ];

        const negationWords = ["don't", "dont", "not", "no", "never"];
        const actionWords = ["unsubscribe", "subscribe", "send", "emails", "email", "marketing"];

        const allKeywords = [
            ...confusionKeywords,
            ...consentContextKeywords,
            ...negationWords,
            ...actionWords,
        ];

        const labels = root.querySelectorAll("label");
        labels.forEach((label) => {
            const text = elementText(label);
            if (!text) return;

            const hasConfusion = confusionKeywords.some((k) => text.includes(k));
            const hasConsentContext = consentContextKeywords.some((k) => text.includes(k));

            const hasNegation = negationWords.some((k) => text.includes(k));
            const hasAction = actionWords.some((k) => text.includes(k));
            const looksDoubleNegative = hasNegation && hasAction && text.split(" ").length > 6;

            if (!(hasConfusion || (hasConsentContext && looksDoubleNegative))) return;

            const relatedInput =
                label.control ||
                label.querySelector("input[type='checkbox'], input[type='radio']");

            const targetEl = findClosestTextElement(label, allKeywords);

            findings.push({
                id: createFindingId(),
                type: FINDING_TYPES.TRICK_QUESTION,
                severity: "medium",
                description: `Potentially confusing consent text on ${describeElement(
                    targetEl
                )}`,
                element: relatedInput || targetEl,
            });

            highlightElement(relatedInput || targetEl, "brown");
        });

        return findings;
    }

    function detectCountdownTimers(root = document) {
        const findings = [];

        const timeRegex = /\b\d{1,2}:\d{2}(?::\d{2})?\b/;

        const urgencyKeywords = [
            "for free",
            "save more",
            "savings",
            "lowest price",
            "cheapest",
            "deal ends in",
            "ends",
            "deal",
            "offer ends in",
            "offer expires in",
            "expires in",
            "ends in",
            "limited time",
            "time left",
            "only a few left",
            "left",
            "limited stock",
            "limited quantity",
            "hurry",
            "act now",
            "last chance",
            "ending soon",
            "today only",
            "sale ends in",
        ];

        const candidates = root.querySelectorAll("span, div, p, strong, time");

        candidates.forEach((el) => {
            const textRaw = el.innerText || el.textContent || "";
            const normalized = normalizeText(textRaw);
            if (!normalized) return;

            const hasClockFormat = timeRegex.test(textRaw);
            const hasUrgency = urgencyKeywords.some((k) => normalized.includes(k));

            if (!hasClockFormat && !hasUrgency) return;
            if (/am|pm/i.test(textRaw) && !hasUrgency) return;

            const targetEl = findClosestTextElement(el, urgencyKeywords);

            if (findings.find(f => f.element === targetEl)) return

            findings.push({
                id: createFindingId(),
                type: FINDING_TYPES.COUNTDOWN_TIMER,
                severity: hasUrgency ? "high" : "low",
                description: `Potential urgency timer on ${describeElement(
                    targetEl
                )}`,
                element: targetEl,
            });

            highlightElement(targetEl, "green");
        });

        return findings;
    }

    function detectDisguisedAds(root = document) {
        const findings = [];

        const sponsorKeywords = [
            "sponsored",
            "sponsered",
            "promoted",
            "promotion",
            "promoted post",
            "ad",
            "advertisement",
            "paid partnership",
            "paid post",
            "partner content",
            "brand content",
        ];

        const candidates = root.querySelectorAll("article, div, li, section");

        candidates.forEach((el) => {
            const txt = elementText(el);
            if (!txt) return;

            const hasSponsored = sponsorKeywords.some((k) => txt.includes(k));
            if (!hasSponsored) return;

            const labelElems = el.querySelectorAll("small, span, div");
            let tinyLabelFound = false;
            let tinyLabelEl = null;

            labelElems.forEach((label) => {
                const labelText = elementText(label);
                if (!labelText) return;

                const labelHasSponsored = sponsorKeywords.some((k) =>
                    labelText.includes(k)
                );
                if (!labelHasSponsored) return;

                const style = window.getComputedStyle(label);
                const fontSize = parseFloat(style.fontSize);
                if (fontSize && fontSize < 11) {
                    tinyLabelFound = true;
                    tinyLabelEl = label;
                }
            });

            const mainLink = el.querySelector("a[href]");
            const hasImage = !!el.querySelector("img");

            if (!(mainLink && hasImage && tinyLabelFound)) return;

            const baseEl = tinyLabelEl || el;
            const targetEl = findClosestTextElement(baseEl, sponsorKeywords);

            findings.push({
                id: createFindingId(),
                type: FINDING_TYPES.DISGUISED_AD,
                severity: "medium",
                description: `Content card (${describeElement(
                    targetEl
                )}) appears to be sponsored but the label may be hard to notice.`,
                element: targetEl,
            });

            highlightElement(targetEl, "blue");
        });

        return findings;
    }

    let allFindings = [];

    function scanPage() {
        if (totalFindingsCount >= MAX_FINDINGS) return;

        const detectors = [
            detectConfirmShaming,
            detectObscuredInterface,
            detectPreselectedOptIn,
            detectTrickQuestions,
            detectCountdownTimers,
            detectDisguisedAds,
        ];

        allFindings = [];
        detectors.forEach((fn) => {
            if (totalFindingsCount >= MAX_FINDINGS) return;
            try {
                const result = fn(document) || [];
                allFindings = allFindings.concat(result);

                totalFindingsCount += result.length;
                if (totalFindingsCount >= MAX_FINDINGS && observer) {
                    observer.disconnect();
                    console.info(
                        "[DarkPatternExtension] Max findings reached, stopping further scans."
                    );
                }
            } catch (e) {
                // Fail-safe
            }
        });

        console.info(
            "[DarkPatternExtension] Findings (this scan):",
            allFindings,
            "Total so far:",
            totalFindingsCount
        );

        updateFloatingPanel();
    }

    let panelEl = null;

    function createFloatingPanel() {
        if (panelEl) return panelEl;

        const panel = document.createElement("div");
        panel.id = "dark-pattern-panel";
        panel.style.position = "fixed";
        panel.style.bottom = "10px";
        panel.style.right = "10px";
        panel.style.zIndex = "2147483647";
        panel.style.background = "rgba(0,0,0,0.85)";
        panel.style.color = "#fff";
        panel.style.padding = "8px 10px";
        panel.style.borderRadius = "6px";
        panel.style.fontSize = "12px";
        panel.style.fontFamily =
            "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        panel.style.maxWidth = "260px";
        panel.style.maxHeight = "40vh";
        panel.style.overflowY = "auto";
        panel.style.boxShadow = "0 2px 10px rgba(0,0,0,0.4)";
        panel.style.cursor = "default";

        const header = document.createElement("div");
        header.style.display = "flex";
        header.style.justifyContent = "space-between";
        header.style.alignItems = "center";
        header.style.marginBottom = "4px";

        const title = document.createElement("span");
        title.textContent = "Dark patterns";
        title.style.fontWeight = "600";

        const closeBtn = document.createElement("button");
        closeBtn.textContent = "×";
        closeBtn.style.border = "none";
        closeBtn.style.background = "transparent";
        closeBtn.style.color = "#fff";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.fontSize = "14px";
        closeBtn.style.lineHeight = "1";

        closeBtn.addEventListener("click", () => {
            panel.style.display = "none";
        });

        header.appendChild(title);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.id = "dark-pattern-panel-body";

        panel.appendChild(header);
        panel.appendChild(body);

        document.documentElement.appendChild(panel);
        panelEl = panel;

        return panel;
    }

    function updateFloatingPanel() {
        const panel = createFloatingPanel();
        const body = panel.querySelector("#dark-pattern-panel-body");
        if (!body) return;

        body.innerHTML = "";

        if (!allFindings.length) {
            body.textContent = "No obvious issues detected.";
            return;
        }

        const grouped = allFindings.reduce((acc, f) => {
            acc[f.type] = acc[f.type] || [];
            acc[f.type].push(f);
            return acc;
        }, {});

        Object.keys(grouped).forEach((type) => {
            const group = grouped[type];

            const groupTitle = document.createElement("div");
            groupTitle.textContent = `${type.replace(/_/g, " ")} (${group.length})`;
            groupTitle.style.fontWeight = "500";
            groupTitle.style.marginTop = "6px";
            body.appendChild(groupTitle);

            group.forEach((f) => {
                const item = document.createElement("div");
                item.textContent = "• " + f.description;
                item.style.marginLeft = "8px";
                item.style.marginTop = "2px";
                item.style.cursor = f.element ? "pointer" : "default";

                if (f.element) {
                    item.addEventListener("click", () => {
                        f.element.scrollIntoView({ behavior: "smooth", block: "center" });
                        const originalTransition = f.element.style.transition;
                        const originalBg = f.element.style.backgroundColor;
                        f.element.style.transition = "background-color 0.3s ease";
                        f.element.style.backgroundColor = "rgba(255, 255, 0, 0.3)";
                        setTimeout(() => {
                            f.element.style.backgroundColor = originalBg;
                            f.element.style.transition = originalTransition;
                        }, 1000);
                    });
                }

                body.appendChild(item);
            });
        });
    }

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            if (!msg || !msg.type) return;

            if (msg.type === "darkPatterns:getFindings") {
                const sanitized = allFindings.map(({ element, ...rest }) => rest);
                sendResponse({ findings: sanitized, url: location.href });
            }
        });
    }

    let scanTimeout = null;
    function scheduleScan() {
        if (totalFindingsCount >= MAX_FINDINGS) return;

        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanPage, 600);
    }

    if (
        document.readyState === "complete" ||
        document.readyState === "interactive"
    ) {
        scheduleScan();
    } else {
        window.addEventListener("DOMContentLoaded", scheduleScan, { once: true });
    }

    let observer = new MutationObserver((mutations) => {
        if (findingsCapReached) {
            observer.disconnect();
            return;
        }

        const significantChange = mutations.some(
            (m) =>
                (m.addedNodes && m.addedNodes.length) ||
                (m.removedNodes && m.removedNodes.length)
        );
        if (significantChange) scheduleScan();
    });


    observer.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
    });

    // window-level hook to give us quick debugging
    window.__darkPatternScanPage = scanPage;
})();
