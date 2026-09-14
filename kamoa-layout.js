/* Kamoa SmartForms header + footer + About/Help, v1.1
   Link this .js AND kamoa-layout.css through Style Profile > Developer.
   Replace the earlier test CSS; it creates its own additional header.
   This script runs in the current document only. It does not move, clone,
   hide, or replace K2 views, buttons, inputs, or their event handlers.
*/
(function () {
    "use strict";

    // EDIT THESE SETTINGS. No <script> tags belong in this file.
    const CONFIG = {
        headerEnabled: true,
        footerEnabled: true,
        title: "Overtime Request Form", // Use "" to take the browser page title.
        brandName: "KAMOA",
        brandSubtitle: "COPPER S.A.",
        logoUrl: "https://happybayarmagnai.github.io/TestStyle/kamoa-icon-png.png", // Optional: https://your-server/approved-logo.png
        logoAlt: "Kamoa Copper S.A.",
        footerText: "Kamoa Copper S.A. All rights reserved.",
        hostSelector: ".theme-entry"
    };

    // ABOUT / HELP CONTENT. Plain text; use \n for a new line.
    const HELP = {
        title: "About / Help",
        text: "Use the menu to navigate between New Request, My Requests, and Waiting for You. Complete the required information before submitting your request.",
        supportText: "" // Optional support contact or instructions.
    };

    const API_NAME = "KamoaSmartFormShell";
    const VERSION = "kamoa-smartform-shell-v1.1-info";
    const previous = window[API_NAME];
    if (previous && previous.version === VERSION) {
        previous.refresh();
        return;
    }
    if (previous && previous.version === "kamoa-smartform-shell-v1" && typeof previous.destroy === "function") {
        previous.destroy();
    } else if (previous) {
        console.warn("Kamoa layout: global name is already in use; no changes made.");
        return;
    }

    // K2 normally excludes linked JS from form design time. Also guard the
    // AppStudio editing document if a script is loaded there manually.
    const authoringHash = /(?:^|[&#])app=AppStudio(?:&|$)/i.test(location.hash);
    const designerPath = /\/designer\/?$/i.test(location.pathname);
    if (authoringHash || designerPath) return;

    let stopped = false;
    let host = null;
    let header = null;
    let footer = null;
    let helpDialog = null;
    let observer = null;
    let scheduled = null;
    let warnedAmbiguous = false;
    let warnedSelector = false;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // HEADER: branding, centered title, information action.
    function createHeader() {
        const node = element("header", "kcjs-header");
        node.setAttribute("data-kamoa-owned", "header");
        const inner = element("div", "kcjs-header__inner");
        const brand = element("div", "kcjs-brand");
        const wordmark = element("div", "kcjs-brand__text");
        wordmark.append(
            element("span", "kcjs-brand__name", CONFIG.brandName),
            element("span", "kcjs-brand__subtitle", CONFIG.brandSubtitle)
        );
        brand.append(wordmark);
        if (CONFIG.logoUrl.trim()) {
            try {
                const url = new URL(CONFIG.logoUrl, document.baseURI);
                if (!/^https?:$/.test(url.protocol)) throw new Error("Use an HTTP(S) logo URL.");
                const img = element("img", "kcjs-brand__image");
                img.alt = CONFIG.logoAlt;
                img.decoding = "async";
                img.addEventListener("load", function () {
                    if (!stopped) wordmark.hidden = true;
                }, { once: true });
                img.addEventListener("error", function () {
                    img.remove();
                    wordmark.hidden = false;
                }, { once: true });
                brand.prepend(img);
                img.src = url.href;
            } catch (error) {
                console.warn("Kamoa layout: using text branding; " + error.message);
            }
        }
        // Text is assigned as textContent, so a page title cannot inject HTML.
        const title = element("div", "kcjs-header__title", CONFIG.title || document.title);
        const actions = element("div", "kcjs-header__actions");
        const info = element("button", "kcjs-info", "i");
        info.type = "button";
        info.title = HELP.title;
        info.setAttribute("aria-label", HELP.title);
        info.setAttribute("aria-haspopup", "dialog");
        actions.append(info);
        inner.append(brand, title, actions);
        node.append(inner);
        helpDialog = createHelpDialog(info);
        node.append(helpDialog);
        info.addEventListener("click", function () {
            if (!helpDialog.open && helpDialog.isConnected) {
                helpDialog.showModal();
                helpDialog.querySelector(".kcjs-help__close").focus();
            }
        });
        return node;
    }

    // ABOUT / HELP: owned markup only; existing K2 controls are not read or changed.
    function createHelpDialog(trigger) {
        const dialog = element("dialog", "kcjs-help");
        dialog.setAttribute("data-kamoa-owned", "help");
        dialog.setAttribute("aria-label", HELP.title);
        const heading = element("div", "kcjs-help__heading");
        heading.append(element("h2", "kcjs-help__title", HELP.title));
        const body = element("div", "kcjs-help__body");
        body.append(element("p", "kcjs-help__text", HELP.text));
        if (HELP.supportText) body.append(element("p", "kcjs-help__text", HELP.supportText));
        const close = element("button", "kcjs-help__close", "Close");
        close.type = "button";
        body.append(close);
        dialog.append(heading, body);

        close.addEventListener("click", function () { dialog.close(); });
        // Escape uses native dialog behavior. Keep Tab on the single popup control.
        dialog.addEventListener("keydown", function (event) {
            if (event.key === "Tab") {
                event.preventDefault();
                close.focus();
            }
        });
        dialog.addEventListener("close", function () {
            if (!stopped && trigger.isConnected) trigger.focus();
        });
        dialog.addEventListener("click", function (event) {
            const rect = dialog.getBoundingClientRect();
            if (event.target === dialog &&
                (event.clientX < rect.left || event.clientX > rect.right ||
                 event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
        });
        return dialog;
    }

    // FOOTER
    function createFooter() {
        const node = element("footer", "kcjs-footer");
        node.setAttribute("data-kamoa-owned", "footer");
        node.append(element("div", "kcjs-footer__inner",
            "© " + new Date().getFullYear() + " " + CONFIG.footerText));
        return node;
    }

    function findHost() {
        let matches;
        try {
            matches = Array.from(document.querySelectorAll(CONFIG.hostSelector));
        } catch (error) {
            if (!warnedSelector) console.warn("Kamoa layout: invalid hostSelector.", error);
            warnedSelector = true;
            return null;
        }
        const roots = matches.filter(function (node) {
            return node.tagName !== "HTML" &&
                !node.closest('dialog, [role="dialog"], [aria-modal="true"]') &&
                !matches.some(function (other) { return other !== node && other.contains(node); });
        });
        if (roots.length === 1) return roots[0];
        if (roots.length > 1 && !warnedAmbiguous) {
            console.warn("Kamoa layout: multiple form roots; set a more specific hostSelector in CONFIG.");
            warnedAmbiguous = true;
        }
        return null;
    }

    function refresh() {
        if (stopped) return;
        const next = findHost();
        if (!next) return;
        if (host !== next) {
            if (helpDialog && helpDialog.open) helpDialog.close();
            // Only our two elements are removed. K2 controls are never touched.
            if (header) header.remove();
            if (footer) footer.remove();
            host = next;
        }
        if (CONFIG.headerEnabled) {
            if (!header) header = createHeader();
            if (header.parentNode !== host) host.prepend(header);
        }
        if (CONFIG.footerEnabled) {
            if (!footer) footer = createFooter();
            if (footer.parentNode !== host) host.append(footer);
            // If K2 appends more visible content after the footer, move only
            // our footer back to the end. Ignore scripts, styles, and links.
            const after = Array.from(host.children).slice(Array.from(host.children).indexOf(footer) + 1);
            if (after.some(function (node) { return !/^(SCRIPT|STYLE|LINK)$/.test(node.tagName); })) host.append(footer);
        }
    }

    function schedule() {
        if (stopped || scheduled !== null) return;
        scheduled = setTimeout(function () {
            scheduled = null;
            refresh();
        }, 50);
    }

    function start() {
        if (stopped) return;
        refresh();
        // Handles a form root appearing late or being replaced by K2.
        // Only child-list changes are watched; no continuous polling.
        observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function destroy() {
        stopped = true;
        document.removeEventListener("DOMContentLoaded", start);
        if (observer) observer.disconnect();
        if (scheduled !== null) clearTimeout(scheduled);
        if (helpDialog && helpDialog.open) helpDialog.close();
        if (header) header.remove();
        if (footer) footer.remove();
        if (window[API_NAME] === api) delete window[API_NAME];
    }

    const api = { version: VERSION, refresh: refresh, destroy: destroy };
    window[API_NAME] = api;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
})();
