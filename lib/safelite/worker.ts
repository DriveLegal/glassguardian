// lib/safelite/worker.ts

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { chromium, type Browser, type Page } from "playwright";

type SafelitePayload = {
  safeliteUrl: string;
  shopNumber: string;
  referralNumber: string;
  vin: string;
  invoiceNumber: string;
  installDate: string;
  laborAmountDollars: string;
  insuranceDueCents?: number;
  insuranceDueDollars?: string;
  documentType: string;
  receiptFilename: string;
  receiptDownloadPath?: string;
  customerSignatureObtained: boolean;
  removeDeductible: boolean;
};

type RunOptions = {
  jobId: string;
  payload: SafelitePayload;
  receiptPdfPath?: string;
  headless?: boolean;
  allowFinalSubmit?: boolean;
  keepBrowserOpenOnReady?: boolean;
  keepBrowserOpenOnFailure?: boolean;
  onLog?: (entry: { at: string; message: string }) => void | Promise<void>;
  onScreenshot?: (screenshot: any) => any | Promise<any>;
};

function nowLog(message: string) {
  return { at: new Date().toISOString(), message };
}

function normalizeMoney(value: string) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  return cleaned || "70.00";
}

function billingAmountFromPayload(payload: SafelitePayload) {
  if (payload.insuranceDueDollars) return normalizeMoney(payload.insuranceDueDollars);
  if (typeof payload.insuranceDueCents === "number" && Number.isFinite(payload.insuranceDueCents)) {
    return (Math.round(payload.insuranceDueCents) / 100).toFixed(2);
  }
  return normalizeMoney(payload.laborAmountDollars);
}

function normalizeDateForInput(value: string) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }

  return raw;
}

function normalizeSafeliteDate(value: string) {
  const raw = normalizeDateForInput(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return raw;

  const [, year, month, day] = match;
  return `${month}/${day}/${year}`;
}

function normalizeSafeliteDateLoose(value: string) {
  const raw = normalizeDateForInput(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return normalizeSafeliteDate(value);

  const [, year, month, day] = match;
  return `${Number(month)}/${Number(day)}/${year}`;
}

async function ensureReceiptPdfInTmp(payload: Pick<SafelitePayload, "receiptFilename" | "receiptDownloadPath">) {
  const receiptFilename = payload.receiptFilename;
  const tmpDir = path.join(process.cwd(), "tmp");
  const tmpPath = path.join(tmpDir, receiptFilename);

  await fs.mkdir(tmpDir, { recursive: true });

  try {
    await fs.access(tmpPath);
    return tmpPath;
  } catch {}

  const downloadsPath = path.join(os.homedir(), "Downloads", receiptFilename);

  try {
    await fs.copyFile(downloadsPath, tmpPath);
    return tmpPath;
  } catch {
    if (payload.receiptDownloadPath) {
      const workerToken = process.env.SAFELITE_WORKER_TOKEN || "";
      const res = await fetch(payload.receiptDownloadPath, {
        headers: workerToken ? { "x-safelite-worker-token": workerToken } : {},
      });

      if (!res.ok) {
        throw new Error(
          `Receipt PDF download failed from ${payload.receiptDownloadPath}: ${res.status}`
        );
      }

      const bytes = new Uint8Array(await res.arrayBuffer());
      await fs.writeFile(tmpPath, bytes);
      return tmpPath;
    }

    throw new Error(
      `Receipt PDF not found. Expected it in Downloads or tmp: ${receiptFilename}`
    );
  }
}

async function screenshot(page: Page, jobId: string, name: string) {
  const dir = path.join(process.cwd(), ".safelite-screenshots", jobId);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });

  return {
    at: new Date().toISOString(),
    name,
    filePath,
  };
}

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function evaluateInBrowser<TResult = any>(page: Page, source: string, arg?: any) {
  return await page.evaluate(
    ({ source, arg }) => Function("arg", `"use strict";\n${source}`)(arg),
    { source, arg }
  ) as TResult;
}

async function evaluateOnElementInBrowser<TResult = any>(
  locator: any,
  source: string,
  arg?: any
) {
  return await locator.evaluate(
    (el: Element, { source, arg }: { source: string; arg: any }) =>
      Function("el", "arg", `"use strict";\n${source}`)(el, arg),
    { source, arg }
  ) as TResult;
}

const BROWSER_EVALUATE_NAME_SHIM = `
  globalThis.__name = globalThis.__name || function(target) {
    return target;
  };
`;

async function installBrowserEvaluateNameShim(page: Page) {
  await page.addInitScript(BROWSER_EVALUATE_NAME_SHIM);
  await page.evaluate(BROWSER_EVALUATE_NAME_SHIM).catch(() => {});
}

async function clickByText(page: Page, text: string) {
  await page.getByText(text, { exact: false }).first().click({ timeout: 15_000 });
}

async function clickButtonByText(page: Page, text: string) {
  const clicked = await page.evaluate((text) => {
    const target = String(text).toLowerCase();

    const candidates = Array.from(
      document.querySelectorAll("button, input[type='button'], input[type='submit'], a")
    ) as HTMLElement[];

    const el = candidates.find((node: any) => {
      const visible = node.offsetWidth > 0 && node.offsetHeight > 0;
      const label = String(node.innerText || node.value || node.textContent || "").toLowerCase();
      return visible && label.includes(target);
    });

    if (!el) return false;

    el.click();
    return true;
  }, text);

  if (!clicked) {
    await clickByText(page, text);
  }
}

async function fillFirst(page: Page, labels: string[], value: string) {
  for (const label of labels) {
    try {
      await page.getByLabel(label, { exact: false }).fill(value, { timeout: 4_000 });
      return true;
    } catch {}
  }

  for (const label of labels) {
    try {
      await page.getByPlaceholder(label, { exact: false }).fill(value, { timeout: 4_000 });
      return true;
    } catch {}
  }

  return false;
}

async function forceFillByCandidates(
  page: Page,
  candidates: string[],
  value: string,
  options?: { inputType?: string }
) {
  return await evaluateInBrowser<boolean>(
    page,
    `
      var candidates = Array.isArray(arg.candidates) ? arg.candidates : [];
      var value = String(arg.value || "");
      var inputType = String(arg.inputType || "").toLowerCase();
      var wanted = [];

      for (var i = 0; i < candidates.length; i += 1) {
        wanted.push(String(candidates[i] || "").toLowerCase().replace(/\\s+/g, " ").trim());
      }

      var inputs = Array.prototype.slice.call(document.querySelectorAll("input, textarea"));
      var best = null;
      var bestScore = 0;

      for (var inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
        var input = inputs[inputIndex];
        var rect = input.getBoundingClientRect();
        var style = window.getComputedStyle(input);
        var type = String(input.type || "").toLowerCase();

        if (rect.width <= 0 || rect.height <= 0) continue;
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (input.disabled || input.readOnly) continue;
        if (inputType && type && type !== inputType) continue;

        var id = input.id || "";
        var labelText = "";
        if (id) {
          var label = document.querySelector('label[for="' + CSS.escape(id) + '"]');
          labelText = label && label.textContent ? label.textContent : "";
        }

        var containerText =
          (input.closest("label") && input.closest("label").textContent) ||
          (input.closest("div") && input.closest("div").textContent) ||
          (input.parentElement && input.parentElement.textContent) ||
          "";

        var meta = String([
          id,
          input.getAttribute("name") || "",
          input.getAttribute("aria-label") || "",
          input.getAttribute("placeholder") || "",
          input.getAttribute("title") || "",
          input.getAttribute("autocomplete") || "",
          labelText,
          containerText
        ].join(" ")).toLowerCase().replace(/\\s+/g, " ").trim();

        var score = 0;
        for (var targetIndex = 0; targetIndex < wanted.length; targetIndex += 1) {
          if (meta.indexOf(wanted[targetIndex]) !== -1) score += 10;
        }

        if (score > bestScore) {
          best = input;
          bestScore = score;
        }
      }

      if (!best) return false;

      best.focus();
      best.value = value;
      best.dispatchEvent(new Event("input", { bubbles: true }));
      best.dispatchEvent(new Event("change", { bubbles: true }));
      best.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
      best.blur();

      return true;
    `,
    { candidates, value, inputType: options?.inputType || "" }
  );
}

async function tagBestInputByCandidates(
  page: Page,
  candidates: string[],
  tag: string,
  options?: { inputType?: string }
) {
  return await evaluateInBrowser<boolean>(
    page,
    `
      var candidates = Array.isArray(arg.candidates) ? arg.candidates : [];
      var tag = String(arg.tag || "");
      var inputType = String(arg.inputType || "").toLowerCase();
      var wanted = [];

      for (var i = 0; i < candidates.length; i += 1) {
        wanted.push(String(candidates[i] || "").toLowerCase().replace(/\\s+/g, " ").trim());
      }

      var inputs = Array.prototype.slice.call(document.querySelectorAll("input, textarea"));
      var best = null;
      var bestScore = 0;

      for (var inputIndex = 0; inputIndex < inputs.length; inputIndex += 1) {
        var input = inputs[inputIndex];
        var rect = input.getBoundingClientRect();
        var style = window.getComputedStyle(input);
        var type = String(input.type || "").toLowerCase();

        if (rect.width <= 0 || rect.height <= 0) continue;
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (input.disabled || input.readOnly) continue;
        if (type === "hidden" || type === "file" || type === "checkbox" || type === "radio") continue;
        if (inputType && type && type !== inputType) continue;

        var nearbyParts = [];
        var node = input;
        for (var depth = 0; depth < 4 && node; depth += 1) {
          nearbyParts.push(node.textContent || "");
          nearbyParts.push(node.previousElementSibling ? node.previousElementSibling.textContent || "" : "");
          nearbyParts.push(node.nextElementSibling ? node.nextElementSibling.textContent || "" : "");
          node = node.parentElement;
        }

        var id = input.id || "";
        var labelText = "";
        if (id) {
          var label = document.querySelector('label[for="' + CSS.escape(id) + '"]');
          labelText = label && label.textContent ? label.textContent : "";
        }

        var meta = String([
          id,
          input.getAttribute("name") || "",
          input.getAttribute("aria-label") || "",
          input.getAttribute("placeholder") || "",
          input.getAttribute("title") || "",
          input.getAttribute("autocomplete") || "",
          type,
          labelText,
          nearbyParts.join(" ")
        ].join(" ")).toLowerCase().replace(/\\s+/g, " ").trim();

        var score = 0;
        for (var targetIndex = 0; targetIndex < wanted.length; targetIndex += 1) {
          if (meta.indexOf(wanted[targetIndex]) !== -1) score += 10;
        }

        if (type === "date") score += 6;
        if (meta.indexOf("install") !== -1) score += 5;
        if (meta.indexOf("date") !== -1) score += 3;
        if (meta.indexOf("loss") !== -1) score -= 8;
        if (meta.indexOf("referral") !== -1) score -= 8;

        if (score > bestScore) {
          best = input;
          bestScore = score;
        }
      }

      if (!best || bestScore <= 0) return false;

      var existing = document.querySelectorAll('[data-gg-safelite-field="' + CSS.escape(tag) + '"]');
      for (var existingIndex = 0; existingIndex < existing.length; existingIndex += 1) {
        existing[existingIndex].removeAttribute("data-gg-safelite-field");
      }

      best.setAttribute("data-gg-safelite-field", tag);
      best.scrollIntoView({ block: "center", inline: "center" });

      return true;
    `,
    { candidates, tag, inputType: options?.inputType || "" }
  );
}

async function typeIntoTaggedInput(page: Page, tag: string, values: string[]) {
  const locator = page.locator(`[data-gg-safelite-field="${tag}"]`).first();

  for (const value of values) {
    try {
      await locator.waitFor({ state: "visible", timeout: 4_000 });
      await locator.scrollIntoViewIfNeeded();
      await locator.click({ timeout: 4_000 });
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await page.keyboard.press("Backspace");
      await wait(150);
      await page.keyboard.type(value, { delay: 85 });
      await wait(250);
      await page.keyboard.press("Tab");
      await wait(650);

      const accepted = await evaluateOnElementInBrowser<boolean>(
        locator,
        `
          var input = el;
          var visibleValue = String(input.value || "").trim();
          var digits = function(v) {
            return String(v || "").replace(/\\D/g, "");
          };
          var attemptedDigits = digits(arg);

          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("blur", { bubbles: true }));

          return (
            visibleValue === String(arg) ||
            digits(visibleValue) === attemptedDigits ||
            (attemptedDigits.length === 8 && digits(visibleValue).endsWith(attemptedDigits.slice(-4)))
          );
        `,
        value
      );

      if (accepted) return true;
    } catch {}
  }

  return false;
}

async function fillInstallDateLikeUser(page: Page, payload: SafelitePayload) {
  const htmlDate = normalizeDateForInput(payload.installDate);
  const safeliteDate = normalizeSafeliteDate(payload.installDate);
  const looseDate = normalizeSafeliteDateLoose(payload.installDate);

  const candidates = [
    "Install Date",
    "Install date",
    "Date Installed",
    "Date of Install",
    "Installation Date",
  ];

  const typedByLabel = await (async () => {
    for (const label of candidates) {
      try {
        const field = page.getByLabel(label, { exact: false }).first();
        await field.waitFor({ state: "visible", timeout: 2_000 });
        await field.scrollIntoViewIfNeeded();

        for (const value of [looseDate, safeliteDate, htmlDate]) {
          await field.click({ timeout: 2_000 });
          await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
          await page.keyboard.press("Backspace");
          await wait(150);
          await page.keyboard.type(value, { delay: 85 });
          await wait(250);
          await page.keyboard.press("Tab");
          await wait(650);

          const accepted = await evaluateOnElementInBrowser<boolean>(
            field,
            `
              var input = el;
              var digits = function(v) {
                return String(v || "").replace(/\\D/g, "");
              };
              var visibleValue = String(input.value || "").trim();

              input.dispatchEvent(new Event("input", { bubbles: true }));
              input.dispatchEvent(new Event("change", { bubbles: true }));
              input.dispatchEvent(new Event("blur", { bubbles: true }));

              return (
                visibleValue === String(arg) ||
                digits(visibleValue) === digits(String(arg))
              );
            `,
            value
          );

          if (accepted) return true;
        }
      } catch {}
    }

    return false;
  })();

  if (typedByLabel) return true;

  const tagged =
    (await tagBestInputByCandidates(page, candidates, "install-date")) ||
    (await tagBestInputByCandidates(page, candidates, "install-date", { inputType: "date" }));

  if (tagged) {
    const typed = await typeIntoTaggedInput(page, "install-date", [
      looseDate,
      safeliteDate,
      htmlDate,
    ]);
    if (typed) return true;
  }

  return (
    (await forceFillByCandidates(page, candidates, htmlDate, { inputType: "date" })) ||
    (await forceFillByCandidates(page, candidates, safeliteDate)) ||
    (await hardFillVisibleInputByIndex(page, 2, htmlDate, "date")) ||
    (await hardFillVisibleInputByIndex(page, 2, safeliteDate))
  );
}

async function hardFillVisibleInputByIndex(
  page: Page,
  index: number,
  value: string,
  type?: string
) {
  return await page.evaluate(
    ({ index, value, type }) => {
      const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];

      const visible = inputs.filter((input) => {
        const rect = input.getBoundingClientRect();
        const style = window.getComputedStyle(input);
        const inputType = String(input.type || "").toLowerCase();

        if (type && inputType !== type) return false;

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !input.disabled &&
          !input.readOnly &&
          inputType !== "checkbox" &&
          inputType !== "radio" &&
          inputType !== "hidden" &&
          inputType !== "file"
        );
      });

      const input = visible[index];
      if (!input) return false;

      input.focus();
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
      input.blur();

      return true;
    },
    { index, value, type: type || "" }
  );
}

async function checkFirst(page: Page, labels: string[]) {
  for (const label of labels) {
    try {
      await page.getByLabel(label, { exact: false }).check({ timeout: 4_000 });
      return true;
    } catch {}
  }

  for (const label of labels) {
    try {
      const checked = await page.evaluate((label) => {
        const clean = (v: unknown) =>
          String(v ?? "")
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

        const target = clean(label);
        const nodes = Array.from(document.querySelectorAll("label, div, p, span"));

        const node = nodes.find((el) => clean(el.textContent).includes(target));
        if (!node) return false;

        const container = node.closest("label") || node.closest("div") || node.parentElement;
        const input =
          container?.querySelector('input[type="checkbox"]') ||
          node.parentElement?.querySelector('input[type="checkbox"]') ||
          null;

        if (!input) return false;

        const checkbox = input as HTMLInputElement;

        if (!checkbox.checked) {
          checkbox.click();
          checkbox.dispatchEvent(new Event("input", { bubbles: true }));
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        }

        return true;
      }, label);

      if (checked) return true;
    } catch {}
  }

  return false;
}

async function selectFirst(page: Page, labels: string[], value: string) {
  for (const label of labels) {
    try {
      await page.getByLabel(label, { exact: false }).selectOption(
        { label: value },
        { timeout: 4_000 }
      );
      return true;
    } catch {}

    try {
      await page.getByLabel(label, { exact: false }).selectOption(value, {
        timeout: 4_000,
      });
      return true;
    } catch {}
  }

  return false;
}

async function selectOptionByText(page: Page, visibleText: string) {
  return await page.evaluate((visibleText) => {
    const target = String(visibleText).toLowerCase();
    const selects = Array.from(document.querySelectorAll("select"));

    for (const select of selects) {
      const options = Array.from(select.options);
      const option = options.find((o) =>
        String(o.textContent ?? "").toLowerCase().includes(target)
      );

      if (option) {
        select.value = option.value;
        option.selected = true;
        select.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("blur", { bubbles: true }));
        return true;
      }
    }

    return false;
  }, visibleText);
}

async function selectNativeOptionByText(page: Page, visibleText: string) {
  const target = String(visibleText).toLowerCase();
  const selects = page.locator("select");
  const count = await selects.count().catch(() => 0);

  for (let i = 0; i < count; i += 1) {
    const select = selects.nth(i);
    const option = await select
      .evaluate((el, target) => {
        const selectEl = el as HTMLSelectElement;
        const options = Array.from(selectEl.options);
        const match = options.find((item) =>
          String(item.textContent ?? "").toLowerCase().includes(String(target))
        );

        if (!match) return null;
        return {
          value: match.value,
          label: match.textContent || "",
          index: options.indexOf(match),
        };
      }, target)
      .catch(() => null);

    if (!option) continue;

    await select.scrollIntoViewIfNeeded().catch(() => {});
    await select.click({ timeout: 2_000 }).catch(() => {});

    try {
      if (option.value) {
        await select.selectOption({ value: option.value }, { timeout: 3_000 });
      } else {
        await select.selectOption({ index: option.index }, { timeout: 3_000 });
      }
    } catch {
      await select.evaluate((el, option) => {
        const selectEl = el as HTMLSelectElement;
        selectEl.selectedIndex = option.index;
        selectEl.value = option.value;
      }, option);
    }

    await select.evaluate((el) => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    });

    await wait(750);

    const selected = await select
      .evaluate((el, target) => {
        const selectEl = el as HTMLSelectElement;
        const selectedOption = selectEl.options[selectEl.selectedIndex];
        return String(selectedOption?.textContent ?? "")
          .toLowerCase()
          .includes(String(target));
      }, target)
      .catch(() => false);

    if (selected) return true;
  }

  return false;
}

async function readSafeliteValidationErrors(page: Page) {
  const text = await page.locator("body").innerText().catch(() => "");
  const knownErrors = [
    "tax field is required",
    "invoice must contain at least one line item",
    "invoiced amount is less than deductible",
    "required",
  ];

  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => {
      const lower = line.toLowerCase();
      return knownErrors.some((needle) => lower.includes(needle));
    });
}

function isPostSubmitRequiredInfoReset(finalText: string, submitErrors: string[]) {
  if (!submitErrors.length) return false;

  const onlyGenericRequiredInfo = submitErrors.every((line) => {
    const normalized = String(line || "")
      .replace(/^\*+/, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    return normalized === "required information" || normalized === "required";
  });

  if (!onlyGenericRequiredInfo) return false;

  const text = String(finalText || "").toLowerCase();
  return (
    text.includes("create invoice") &&
    text.includes("referral information") &&
    text.includes("work order information")
  );
}

async function selectPartByText(page: Page, visibleText: string) {
  async function partSelectionLooksSelected() {
    return await page.evaluate((visibleText) => {
      const clean = (v: unknown) =>
        String(v ?? "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      function isVisible(el: Element) {
        const node = el as HTMLElement;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      const wanted = clean(visibleText);

      const selectedNative = Array.from(document.querySelectorAll("select")).some((select) => {
        if (!isVisible(select)) return false;
        const selectedOption = select.options[select.selectedIndex];
        return clean(selectedOption?.textContent).includes(wanted);
      });

      if (selectedNative) return true;

      return Array.from(
        document.querySelectorAll("button, [role='button'], [role='combobox'], [aria-haspopup='listbox'], .select2-selection, .dropdown-toggle, [class*='select'], div, span")
      ).some((node) => {
        if (!isVisible(node)) return false;
        const text = clean((node as HTMLElement).innerText || node.textContent);
        if (!text.includes(wanted)) return false;
        const rect = (node as HTMLElement).getBoundingClientRect();
        return rect.width < 520 && rect.height < 90;
      });
    }, visibleText);
  }

  const playwrightNativeSelected = await selectNativeOptionByText(page, visibleText).catch(() => false);
  if (playwrightNativeSelected && (await partSelectionLooksSelected())) return true;

  const nativeSelected = await selectOptionByText(page, visibleText).catch(() => false);

  if (nativeSelected) {
    await wait(750);
    const selected = await page.evaluate((visibleText) => {
      const target = String(visibleText).toLowerCase();
      return Array.from(document.querySelectorAll("select")).some((select) => {
        const selectedOption = select.options[select.selectedIndex];
        return String(selectedOption?.textContent ?? "").toLowerCase().includes(target);
      });
    }, visibleText);

    if (selected && (await partSelectionLooksSelected())) return true;
  }

  async function clickPartDropdown() {
    const clickedByText = await page
      .getByText("Select Part", { exact: false })
      .first()
      .click({ timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    if (clickedByText) return true;

    return await page.evaluate(() => {
      const clean = (v: unknown) =>
        String(v ?? "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      function isVisible(el: Element) {
        const node = el as HTMLElement;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      const candidates = Array.from(
        document.querySelectorAll(
          [
            "button",
            "[role='button']",
            "[role='combobox']",
            "[aria-haspopup='listbox']",
            ".select2-selection",
            ".dropdown-toggle",
            "[class*='select']",
            "div",
            "span",
          ].join(",")
        )
      ) as HTMLElement[];

      const ranked = candidates
        .filter((node) => {
          if (!isVisible(node)) return false;
          const text = clean(node.innerText || node.textContent || node.getAttribute("aria-label"));
          return text === "select part" || text.includes("select part");
        })
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { node, area: rect.width * rect.height };
        })
        .sort((a, b) => a.area - b.area);

      const opener = ranked[0]?.node;
      if (!opener) return false;

      opener.scrollIntoView({ block: "center", inline: "center" });
      opener.click();
      return true;
    });
  }

  async function clickOpenOption() {
    const optionTexts = [visibleText, "LABOR Part", "LABOR", "WSREPAIR"];

    for (const text of optionTexts) {
      const clicked = await page
        .getByText(text, { exact: false })
        .last()
        .click({ timeout: 2_500 })
        .then(() => true)
        .catch(() => false);

      if (clicked) return true;
    }

    return await page.evaluate((visibleText) => {
      const clean = (v: unknown) =>
        String(v ?? "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      function isVisible(el: Element) {
        const node = el as HTMLElement;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      const wanted = clean(visibleText);
      const candidates = Array.from(
        document.querySelectorAll(
          "li, option, a, button, [role='option'], [role='menuitem'], .select2-results__option, .dropdown-item, div, span"
        )
      ) as HTMLElement[];

      const option = candidates
        .filter((node) => {
          if (!isVisible(node)) return false;
          const text = clean(node.innerText || node.textContent || node.getAttribute("aria-label"));
          return (
            text.includes(wanted) ||
            text.includes("labor part") ||
            text === "labor" ||
            text.includes("wsrepair")
          );
        })
        .map((node) => {
          const rect = node.getBoundingClientRect();
          return { node, area: rect.width * rect.height };
        })
        .sort((a, b) => a.area - b.area)[0]?.node;

      if (!option) return false;

      option.scrollIntoView({ block: "center", inline: "center" });
      option.click();
      return true;
    }, visibleText);
  }

  async function keyboardSelect() {
    await page.keyboard.type("LABOR", { delay: 70 }).catch(() => {});
    await wait(400);
    await page.keyboard.press("Enter").catch(() => {});
    await wait(800);

    const selected = await page.evaluate(() => {
      const body = document.body?.innerText || "";
      return /LABOR\s+Part|WSREPAIR/i.test(body);
    });

    if (selected) return true;

    await page.keyboard.press("ArrowDown").catch(() => {});
    await wait(200);
    await page.keyboard.press("Enter").catch(() => {});
    await wait(800);

    return await page.evaluate(() => {
      const body = document.body?.innerText || "";
      return /LABOR\s+Part|WSREPAIR/i.test(body);
    });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const opened = await clickPartDropdown();
    if (!opened) break;

    await wait(700);

    const clickedOption = await clickOpenOption();
    if (clickedOption) {
      await wait(900);
      if (await partSelectionLooksSelected()) return true;
    }

    if ((await keyboardSelect()) && (await partSelectionLooksSelected())) return true;
  }

  const opened = await page.evaluate((visibleText) => {
    const clean = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    function isVisible(el: Element) {
      const node = el as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }

    const wanted = clean(visibleText);
    const candidates = Array.from(
      document.querySelectorAll(
        "button, [role='combobox'], [aria-haspopup='listbox'], .select2-selection, .dropdown-toggle, select, div, span"
      )
    ) as HTMLElement[];

    const opener = candidates.find((node) => {
      if (!isVisible(node)) return false;
      const text = clean(node.innerText || node.textContent || node.getAttribute("aria-label"));
      if (!text) return false;
      return text.includes("select part") || text === "part" || text.includes(wanted);
    });

    if (!opener) return false;
    opener.scrollIntoView({ block: "center", inline: "center" });
    opener.click();
    return true;
  }, visibleText);

  if (opened) {
    await wait(750);
    try {
      await page.getByText(visibleText, { exact: false }).last().click({ timeout: 3_000 });
      await wait(750);
      return await partSelectionLooksSelected();
    } catch {}
  }

  return (
    ((await selectNativeOptionByText(page, visibleText).catch(() => false)) &&
      (await partSelectionLooksSelected())) ||
    ((await selectOptionByText(page, visibleText).catch(() => false)) &&
      (await partSelectionLooksSelected()))
  );
}

async function hasLaborLineItem(page: Page) {
  return await page.evaluate(() => {
    const body = document.body?.innerText || "";
    return /WSREPAIR|LABOR\s+Part/i.test(body);
  });
}

async function tagLaborAmountInput(page: Page) {
  return await page.evaluate(() => {
    const clean = (v: unknown) =>
      String(v ?? "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();

    function isVisible(el: HTMLElement) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }

    function nearbyText(input: HTMLElement) {
      const parts: string[] = [];
      let node: HTMLElement | null = input;

      for (let i = 0; i < 4 && node; i += 1) {
        parts.push(node.textContent || "");
        parts.push((node.previousElementSibling as HTMLElement | null)?.textContent || "");
        parts.push((node.nextElementSibling as HTMLElement | null)?.textContent || "");
        node = node.parentElement;
      }

      return parts.join(" ");
    }

    const header = Array.from(document.querySelectorAll("th, [role='columnheader'], div, span"))
      .map((node) => ({ node: node as HTMLElement, text: clean(node.textContent) }))
      .filter(({ node, text }) => isVisible(node) && text === "labor")
      .sort((a, b) => a.node.getBoundingClientRect().top - b.node.getBoundingClientRect().top)[0]
      ?.node;

    const laborCenterX = header
      ? header.getBoundingClientRect().left + header.getBoundingClientRect().width / 2
      : null;

    const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
    const ranked = inputs
      .filter((input) => {
        const type = clean(input.type);
        return (
          isVisible(input) &&
          !input.disabled &&
          !input.readOnly &&
          type !== "hidden" &&
          type !== "file" &&
          type !== "checkbox" &&
          type !== "radio"
        );
      })
      .map((input) => {
        const rect = input.getBoundingClientRect();
        const rowText = clean(
          input.closest("tr")?.textContent ||
            input.closest("[role='row']")?.textContent ||
            input.closest("div")?.textContent ||
            nearbyText(input)
        );
        const meta = clean(
          `${input.id} ${input.name} ${input.placeholder} ${input.getAttribute("aria-label")} ${nearbyText(input)}`
        );

        let score = 0;
        if (meta.includes("labor")) score += 80;
        if (rowText.includes("wsrepair") || rowText.includes("labor part")) score += 35;
        if (laborCenterX != null) {
          const centerX = rect.left + rect.width / 2;
          score += Math.max(0, 70 - Math.abs(centerX - laborCenterX));
        }
        if (/^\$?0(?:\.00)?$/.test(clean(input.value))) score += 8;
        if (rowText.includes("sales tax") || rowText.includes("deductible") || rowText.includes("submitted total")) {
          score -= 120;
        }
        if (meta.includes("list/cost") || meta.includes("selling") || meta.includes("kit")) {
          score -= 20;
        }

        return { input, score };
      })
      .filter((item) => item.score > 20)
      .sort((a, b) => b.score - a.score);

    const input = ranked[0]?.input;
    if (!input) return false;

    document
      .querySelectorAll('[data-gg-safelite-field="labor-amount"]')
      .forEach((el) => el.removeAttribute("data-gg-safelite-field"));

    input.setAttribute("data-gg-safelite-field", "labor-amount");
    input.scrollIntoView({ block: "center", inline: "center" });
    return true;
  });
}

async function fillSalesTaxZero(page: Page) {
  const tagged = await tagBestInputByCandidates(page, ["Sales tax", "Sales Tax"], "sales-tax");
  if (tagged) {
    const typed = await typeIntoTaggedInput(page, "sales-tax", ["0.00", "$0.00", "0"]);
    if (typed) return true;
  }

  return (
    (await forceFillByCandidates(page, ["Sales tax", "Sales Tax"], "0.00")) ||
    (await page.evaluate(() => {
      const clean = (v: unknown) =>
        String(v ?? "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      function isVisible(el: HTMLElement) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
      const taxInput = inputs.find((input) => {
        if (!isVisible(input) || input.disabled || input.readOnly) return false;
        const text = clean(
          `${input.id} ${input.name} ${input.placeholder} ${input.getAttribute("aria-label")} ${input.closest("div")?.textContent || ""} ${input.parentElement?.textContent || ""}`
        );
        return text.includes("sales tax");
      });

      if (!taxInput) return false;

      taxInput.focus();
      taxInput.value = "0.00";
      taxInput.dispatchEvent(new Event("input", { bubbles: true }));
      taxInput.dispatchEvent(new Event("change", { bubbles: true }));
      taxInput.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
      taxInput.blur();
      return true;
    }))
  );
}

async function fillInvoiceInfo(page: Page, payload: SafelitePayload) {
  let vinFilled =
    (await fillFirst(page, ["Enter full VIN", "Full VIN", "VIN"], payload.vin)) ||
    (await forceFillByCandidates(page, ["vin", "enter full vin", "full vin"], payload.vin));

  let invoiceFilled =
    (await fillFirst(
      page,
      ["Invoice number", "Invoice Number", "Invoice #"],
      payload.invoiceNumber
    )) ||
    (await forceFillByCandidates(
      page,
      ["invoice number", "invoice #", "invoice"],
      payload.invoiceNumber
    ));

  let installFilled = await fillInstallDateLikeUser(page, payload);

  if (!vinFilled) vinFilled = await hardFillVisibleInputByIndex(page, 0, payload.vin);
  if (!invoiceFilled) invoiceFilled = await hardFillVisibleInputByIndex(page, 1, payload.invoiceNumber);

  if (payload.removeDeductible) {
    await checkFirst(page, [
      "Remove deductible",
      "Remove Deductible",
      "deductible does not apply",
    ]);
  }

  if (payload.customerSignatureObtained) {
    await checkFirst(page, [
      "Customer signature obtained",
      "Customer Signature Obtained",
      "Customer signature",
      "signature obtained",
    ]);
  }

  await wait(1000);

  return vinFilled && invoiceFilled && installFilled;
}

async function laborAmountAppears(page: Page, laborAmountDollars: string) {
  const laborAmount = normalizeMoney(laborAmountDollars);
  const money = `$${laborAmount}`;

  return await evaluateInBrowser<boolean>(
    page,
    `
      var money = String(arg.money || "");
      var raw = String(arg.raw || "");
      var text = String(document.body && document.body.innerText || "")
        .replace(/\\s+/g, " ")
        .trim();

      if (!text) return false;
      if (text.indexOf(money) !== -1) return true;

      var laborPattern = new RegExp("labor total\\\\s*" + money.replace(/[$.]/g, "\\\\$&"), "i");
      var submittedPattern = new RegExp("submitted total\\\\s*" + money.replace(/[$.]/g, "\\\\$&"), "i");

      return laborPattern.test(text) || submittedPattern.test(text) || text.indexOf(raw) !== -1;
    `,
    { money, raw: laborAmount }
  );
}

async function forceFillLaborAmountByRow(page: Page, laborAmountDollars: string) {
  const laborAmount = normalizeMoney(laborAmountDollars);
  const money = `$${laborAmount}`;

  return await evaluateInBrowser<boolean>(
    page,
    `
      var money = String(arg.money || "");

      function textOf(node) {
        return String(node && (node.innerText || node.textContent) || "")
          .toLowerCase()
          .replace(/\\s+/g, " ")
          .trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      function setInputValue(input, value) {
        input.focus();

        var ownSetter = Object.getOwnPropertyDescriptor(input, "value");
        var proto = Object.getPrototypeOf(input);
        var protoSetter = proto ? Object.getOwnPropertyDescriptor(proto, "value") : null;
        var setter = (protoSetter && protoSetter.set) || (ownSetter && ownSetter.set);

        if (setter) {
          setter.call(input, value);
        } else {
          input.value = value;
        }

        input.setAttribute("value", value);

        try {
          input.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: value
          }));
        } catch {
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }

        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
        input.blur();
      }

      var rowSelectors = "tr, [role='row'], .row, div";
      var rows = Array.prototype.slice.call(document.querySelectorAll(rowSelectors));
      var matchingRows = rows
        .filter(function(row) {
          var text = textOf(row);
          return (
            isVisible(row) &&
            row.querySelectorAll("input").length > 0 &&
            (text.indexOf("wsrepair") !== -1 || text.indexOf("labor part") !== -1)
          );
        })
        .map(function(row) {
          var rect = row.getBoundingClientRect();
          return { row: row, area: rect.width * rect.height };
        })
        .sort(function(a, b) {
          return a.area - b.area;
        });

      var root = matchingRows.length ? matchingRows[0].row : document.body;
      var inputs = Array.prototype.slice.call(root.querySelectorAll("input"));
      var visibleInputs = inputs.filter(function(input) {
        var rect = input.getBoundingClientRect();
        var style = window.getComputedStyle(input);
        var type = String(input.type || "").toLowerCase();

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          !input.disabled &&
          !input.readOnly &&
          type !== "hidden" &&
          type !== "file" &&
          type !== "checkbox" &&
          type !== "radio"
        );
      });

      var laborInput =
        visibleInputs.find(function(input) {
          return String([
            input.name || "",
            input.id || "",
            input.placeholder || "",
            input.getAttribute("aria-label") || "",
            input.closest("td") && input.closest("td").textContent || "",
            input.closest("div") && input.closest("div").textContent || ""
          ].join(" ")).toLowerCase().indexOf("labor") !== -1;
        }) ||
        visibleInputs[visibleInputs.length - 1];

      if (!laborInput) return false;

      laborInput.scrollIntoView({ block: "center", inline: "center" });
      setInputValue(laborInput, money);

      return true;
    `,
    { money }
  );
}

async function addLaborPart(page: Page, laborAmountDollars: string) {
  const partSelected = await selectPartByText(page, "LABOR Part");
  if (!partSelected) return false;

  await wait(1000);

  await clickButtonByText(page, "Add part").catch(() => {});
  await wait(2500);

  const lineItemAdded = await hasLaborLineItem(page);
  if (!lineItemAdded) return false;

  const laborAmount = normalizeMoney(laborAmountDollars);
  const rowFilled = await forceFillLaborAmountByRow(page, laborAmount);
  if (rowFilled) {
    await wait(1000);
    if (await laborAmountAppears(page, laborAmount)) return true;
  }

  const tagged = await tagLaborAmountInput(page);
  if (tagged) {
    const typed = await typeIntoTaggedInput(page, "labor-amount", [
      laborAmount,
      `$${laborAmount}`,
    ]);
    if (typed) {
      await wait(1000);
      if (await laborAmountAppears(page, laborAmount)) return true;
    }
  }

  const filled = await forceFillLaborAmountByRow(page, laborAmount);
  if (!filled) return false;

  await wait(1000);
  return await laborAmountAppears(page, laborAmount);
}

async function documentTypeSelectionLooksCorrect(page: Page, documentType: string) {
  return await evaluateInBrowser<boolean>(
    page,
    `
      var wanted = String(arg || "").toLowerCase().replace(/\\s+/g, " ").trim();

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var selects = Array.prototype.slice.call(document.querySelectorAll("select"));
      for (var i = 0; i < selects.length; i += 1) {
        var select = selects[i];
        if (!isVisible(select)) continue;

        var selectedOption = select.options[select.selectedIndex];
        var selectedText = clean(selectedOption && selectedOption.textContent);
        var context = clean(
          (select.closest("label") && select.closest("label").textContent) ||
          (select.closest("div") && select.closest("div").textContent) ||
          (select.parentElement && select.parentElement.textContent) ||
          ""
        );

        if (selectedText.indexOf(wanted) !== -1) {
          return true;
        }
      }

      var controls = Array.prototype.slice.call(
        document.querySelectorAll("button, [role='combobox'], [aria-haspopup='listbox'], .select2-selection, .dropdown-toggle, [class*='select']")
      );

      for (var controlIndex = 0; controlIndex < controls.length; controlIndex += 1) {
        var control = controls[controlIndex];
        if (!isVisible(control)) continue;

        var text = clean(control.innerText || control.textContent || control.getAttribute("aria-label"));
        var parentText = clean(
          (control.closest("label") && control.closest("label").textContent) ||
          (control.closest("div") && control.closest("div").textContent) ||
          ""
        );

        if (text.indexOf(wanted) !== -1 && parentText.indexOf("document type") !== -1) {
          return true;
        }
      }

      return false;
    `,
    documentType
  );
}

async function findUploadedDocumentTypeSelect(page: Page, documentType: string) {
  return await evaluateInBrowser<{
    index: number;
    value: string;
    optionIndex: number;
  } | null>(
    page,
    `
      var wanted = String(arg || "").toLowerCase().replace(/\\s+/g, " ").trim();

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var selects = Array.prototype.slice.call(document.querySelectorAll("select"));
      var ranked = [];

      for (var selectIndex = 0; selectIndex < selects.length; selectIndex += 1) {
        var select = selects[selectIndex];
        if (!isVisible(select) || select.disabled) continue;

        var options = Array.prototype.slice.call(select.options);
        var option = options.find(function(item) {
          return clean(item.textContent).indexOf(wanted) !== -1;
        });

        if (!option) continue;

        var context = clean(
          [
            select.id || "",
            select.name || "",
            select.getAttribute("aria-label") || "",
            select.closest("label") && select.closest("label").textContent || "",
            select.closest("tr") && select.closest("tr").textContent || "",
            select.closest("[role='row']") && select.closest("[role='row']").textContent || "",
            select.closest("div") && select.closest("div").textContent || "",
            select.parentElement && select.parentElement.textContent || ""
          ].join(" ")
        );

        var score = 0;
        if (context.indexOf("document type") !== -1) score += 100;
        if (context.indexOf("supporting documentation") !== -1) score += 40;
        if (context.indexOf(".pdf") !== -1 || context.indexOf(".png") !== -1 || context.indexOf(".jpg") !== -1) score += 30;
        if (context.indexOf("work order") !== -1) score += 10;

        ranked.push({
          index: selectIndex,
          value: option.value,
          optionIndex: options.indexOf(option),
          score: score
        });
      }

      ranked.sort(function(a, b) {
        return b.score - a.score;
      });

      return ranked[0] || null;
    `,
    documentType
  );
}

async function selectUploadedDocumentTypeNative(page: Page, documentType: string) {
  const candidate = await findUploadedDocumentTypeSelect(page, documentType).catch(() => null);
  if (!candidate) return false;

  const select = page.locator("select").nth(candidate.index);
  await select.scrollIntoViewIfNeeded().catch(() => {});
  await select.focus().catch(() => {});

  try {
    if (candidate.value) {
      await select.selectOption({ value: candidate.value }, { timeout: 4000 });
    } else {
      await select.selectOption({ index: candidate.optionIndex }, { timeout: 4000 });
    }
  } catch {
    await select.evaluate((el, candidate) => {
      const selectEl = el as HTMLSelectElement;
      selectEl.selectedIndex = candidate.optionIndex;
      selectEl.value = candidate.value;
    }, candidate);
  }

  await select.evaluate((el) => {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });

  await page.keyboard.press("Enter").catch(() => {});
  await wait(250);
  await page.keyboard.press("Tab").catch(() => {});
  await wait(250);
  await page.mouse.click(20, 20).catch(() => {});
  await wait(1000);

  return await documentTypeSelectionLooksCorrect(page, documentType);
}

async function clickUploadedDocumentTypeLikeUser(page: Page, documentType: string) {
  const opened = await evaluateInBrowser<{ x: number; y: number } | null>(
    page,
    `
      var wanted = String(arg || "").toLowerCase().replace(/\\s+/g, " ").trim();

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var controls = Array.prototype.slice.call(
        document.querySelectorAll("select, button, [role='combobox'], [aria-haspopup='listbox'], .select2-selection, .dropdown-toggle, [class*='select']")
      );
      var ranked = [];

      for (var i = 0; i < controls.length; i += 1) {
        var control = controls[i];
        if (!isVisible(control)) continue;

        var context = clean(
          [
            control.id || "",
            control.getAttribute("name") || "",
            control.getAttribute("aria-label") || "",
            control.innerText || "",
            control.textContent || "",
            control.closest("label") && control.closest("label").textContent || "",
            control.closest("tr") && control.closest("tr").textContent || "",
            control.closest("div") && control.closest("div").textContent || "",
            control.parentElement && control.parentElement.textContent || ""
          ].join(" ")
        );

        var score = 0;
        if (context.indexOf("document type") !== -1) score += 100;
        if (context.indexOf("supporting documentation") !== -1) score += 40;
        if (context.indexOf(".pdf") !== -1 || context.indexOf(".png") !== -1 || context.indexOf(".jpg") !== -1) score += 30;
        if (context.indexOf(wanted) !== -1) score += 15;
        if (score <= 0) continue;

        var rect = control.getBoundingClientRect();
        ranked.push({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          score: score
        });
      }

      ranked.sort(function(a, b) {
        return b.score - a.score;
      });

      return ranked[0] || null;
    `,
    documentType
  ).catch(() => null);

  if (!opened) return false;

  await page.mouse.click(opened.x, opened.y).catch(() => {});
  await wait(750);

  const clickedOption = await page
    .getByText(documentType, { exact: true })
    .last()
    .click({ timeout: 2500 })
    .then(() => true)
    .catch(() => false);

  if (!clickedOption) {
    await page.keyboard.press("ArrowDown").catch(() => {});
    await wait(150);
    await page.keyboard.press("Enter").catch(() => {});
  }

  await wait(250);
  await page.keyboard.press("Tab").catch(() => {});
  await wait(250);
  await page.mouse.click(20, 20).catch(() => {});
  await wait(1000);

  return await documentTypeSelectionLooksCorrect(page, documentType);
}

function compactLogText(value: string, maxLength = 700) {
  const compact = String(value || "").replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

async function summarizeVisibleDocumentTypeSelects(page: Page) {
  const summary = await evaluateInBrowser<{
    count: number;
    items: Array<{
      index: number;
      selectedText: string;
      optionTexts: string[];
      context: string;
    }>;
  }>(
    page,
    `
      function clean(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var selects = Array.prototype.slice.call(document.querySelectorAll("select"));
      var items = [];

      for (var i = 0; i < selects.length; i += 1) {
        var select = selects[i];
        if (!isVisible(select)) continue;

        var selectedOption = select.options[select.selectedIndex];
        var optionTexts = Array.prototype.slice.call(select.options)
          .map(function(option) { return clean(option.textContent); })
          .filter(Boolean);
        var context = clean(
          [
            select.id || "",
            select.name || "",
            select.getAttribute("aria-label") || "",
            select.closest("label") && select.closest("label").textContent || "",
            select.closest("tr") && select.closest("tr").textContent || "",
            select.closest("[role='row']") && select.closest("[role='row']").textContent || "",
            select.closest("div") && select.closest("div").textContent || "",
            select.parentElement && select.parentElement.textContent || ""
          ].join(" ")
        ).slice(0, 240);

        items.push({
          index: i,
          selectedText: clean(selectedOption && selectedOption.textContent),
          optionTexts: optionTexts.slice(0, 10),
          context: context
        });
      }

      return { count: items.length, items: items };
    `
  ).catch(() => ({ count: 0, items: [] }));

  if (!summary.items.length) return "0 visible select(s).";

  return `${summary.count} visible select(s): ${summary.items
    .map((item) =>
      `#${item.index} selected="${item.selectedText || "(blank)"}" options="${item.optionTexts.join(
        " | "
      )}" context="${item.context}"`
    )
    .join("; ")}`;
}

async function waitForUploadedDocumentRow(page: Page, fileName: string) {
  const baseName = path.basename(fileName || "");
  const firstNeedle = baseName.slice(0, Math.min(28, baseName.length)).toLowerCase();
  const genericNeedles = ["document type for", "upload supporting documentation", ".pdf"];

  return await page
    .waitForFunction(
      ({ firstNeedle, genericNeedles }) => {
        const text = String(document.body?.innerText || "").toLowerCase();
        const hasGeneric = genericNeedles.some((needle) => text.includes(needle));
        return hasGeneric && (!firstNeedle || text.includes(firstNeedle) || text.includes(".pdf"));
      },
      { firstNeedle, genericNeedles },
      { timeout: 60_000 }
    )
    .then(() => true)
    .catch(() => false);
}

async function setDocumentTypeOnUploadedRowSelect(
  page: Page,
  documentType: string,
  fileName: string
) {
  return await evaluateInBrowser<{
    ok: boolean;
    visibleSelectCount: number;
    chosenIndex: number | null;
    chosenScore: number;
    selectedText: string;
    optionTexts: string[];
    context: string;
    reason?: string;
  }>(
    page,
    `
      var wanted = String(arg.documentType || "").toLowerCase().replace(/\\s+/g, " ").trim();
      var fileName = String(arg.fileName || "").toLowerCase();
      var fileBase = fileName.replace(/\\.[a-z0-9]+$/i, "");
      var fileNeedles = [
        fileName,
        fileBase,
        fileBase.slice(0, 30),
        "glassguardian",
        "safelite-workorder",
        ".pdf"
      ].filter(function(item) {
        return item && item.length >= 4;
      });

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function cleanDisplay(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      function selectContext(select) {
        var chunks = [
          select.id || "",
          select.name || "",
          select.getAttribute("aria-label") || "",
          select.closest("label") && select.closest("label").textContent || "",
          select.closest("tr") && select.closest("tr").textContent || "",
          select.closest("[role='row']") && select.closest("[role='row']").textContent || "",
          select.closest("li") && select.closest("li").textContent || "",
          select.closest("section") && select.closest("section").textContent || "",
          select.closest("fieldset") && select.closest("fieldset").textContent || "",
          select.closest("div") && select.closest("div").textContent || "",
          select.parentElement && select.parentElement.textContent || ""
        ];

        return clean(chunks.join(" "));
      }

      var selects = Array.prototype.slice.call(document.querySelectorAll("select"));
      var visibleSelects = selects.filter(function(select) {
        return isVisible(select) && !select.disabled;
      });
      var ranked = [];

      for (var i = 0; i < visibleSelects.length; i += 1) {
        var select = visibleSelects[i];
        var options = Array.prototype.slice.call(select.options);
        var option = options.find(function(item) {
          return clean(item.textContent).indexOf(wanted) !== -1;
        });
        if (!option) continue;

        var context = selectContext(select);
        var score = 0;
        if (context.indexOf("document type") !== -1) score += 120;
        if (context.indexOf("document type for") !== -1) score += 80;
        if (context.indexOf("supporting documentation") !== -1) score += 40;
        if (context.indexOf("work order") !== -1) score += 20;
        if (context.indexOf("select") !== -1) score += 5;

        for (var needleIndex = 0; needleIndex < fileNeedles.length; needleIndex += 1) {
          if (context.indexOf(fileNeedles[needleIndex]) !== -1) {
            score += 100;
            break;
          }
        }

        if (score <= 0) score = 1;

        ranked.push({
          select: select,
          option: option,
          optionIndex: options.indexOf(option),
          selectIndex: selects.indexOf(select),
          score: score,
          context: context,
          optionTexts: options.map(function(item) { return cleanDisplay(item.textContent); }).filter(Boolean)
        });
      }

      ranked.sort(function(a, b) {
        return b.score - a.score;
      });

      var winner = ranked[0];
      if (!winner) {
        return {
          ok: false,
          visibleSelectCount: visibleSelects.length,
          chosenIndex: null,
          chosenScore: 0,
          selectedText: "",
          optionTexts: [],
          context: "",
          reason: "No visible select had a Work Order option."
        };
      }

      winner.select.scrollIntoView({ block: "center", inline: "center" });
      winner.select.focus();

      var valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
      if (valueSetter && valueSetter.set) {
        valueSetter.set.call(winner.select, winner.option.value);
      } else {
        winner.select.value = winner.option.value;
      }

      winner.select.selectedIndex = winner.optionIndex;
      winner.option.selected = true;

      winner.select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      winner.select.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      winner.select.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      winner.select.dispatchEvent(new Event("input", { bubbles: true }));
      winner.select.dispatchEvent(new Event("change", { bubbles: true }));
      winner.select.dispatchEvent(new Event("blur", { bubbles: true }));
      winner.select.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));

      var selectedOption = winner.select.options[winner.select.selectedIndex];
      var selectedText = cleanDisplay(selectedOption && selectedOption.textContent);

      return {
        ok: clean(selectedText).indexOf(wanted) !== -1,
        visibleSelectCount: visibleSelects.length,
        chosenIndex: winner.selectIndex,
        chosenScore: winner.score,
        selectedText: selectedText,
        optionTexts: winner.optionTexts.slice(0, 10),
        context: winner.context.slice(0, 300)
      };
    `,
    { documentType, fileName }
  );
}

async function verifyUploadedDocumentTypeSelect(
  page: Page,
  documentType: string,
  fileName: string
) {
  return await evaluateInBrowser<boolean>(
    page,
    `
      var wanted = String(arg.documentType || "").toLowerCase().replace(/\\s+/g, " ").trim();
      var fileName = String(arg.fileName || "").toLowerCase();
      var fileBase = fileName.replace(/\\.[a-z0-9]+$/i, "");
      var fileNeedles = [
        fileName,
        fileBase,
        fileBase.slice(0, 30),
        "glassguardian",
        "safelite-workorder",
        ".pdf"
      ].filter(function(item) {
        return item && item.length >= 4;
      });

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var selects = Array.prototype.slice.call(document.querySelectorAll("select"));
      for (var i = 0; i < selects.length; i += 1) {
        var select = selects[i];
        if (!isVisible(select) || select.disabled) continue;

        var selectedOption = select.options[select.selectedIndex];
        var selectedText = clean(selectedOption && selectedOption.textContent);
        if (selectedText.indexOf(wanted) === -1) continue;

        var context = clean(
          [
            select.id || "",
            select.name || "",
            select.getAttribute("aria-label") || "",
            select.closest("label") && select.closest("label").textContent || "",
            select.closest("tr") && select.closest("tr").textContent || "",
            select.closest("[role='row']") && select.closest("[role='row']").textContent || "",
            select.closest("li") && select.closest("li").textContent || "",
            select.closest("section") && select.closest("section").textContent || "",
            select.closest("fieldset") && select.closest("fieldset").textContent || "",
            select.closest("div") && select.closest("div").textContent || "",
            select.parentElement && select.parentElement.textContent || ""
          ].join(" ")
        );

        var hasDocumentContext = context.indexOf("document type") !== -1;
        var hasFileContext = fileNeedles.some(function(needle) {
          return context.indexOf(needle) !== -1;
        });

        if (hasDocumentContext || hasFileContext) return true;
      }

      return false;
    `,
    { documentType, fileName }
  ).catch(() => false);
}

async function customUploadedDocumentTypeLooksCorrect(page: Page, documentType: string) {
  return await evaluateInBrowser<boolean>(
    page,
    `
      var wanted = String(arg || "").toLowerCase().replace(/\\s+/g, " ").trim();

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var controls = Array.prototype.slice.call(
        document.querySelectorAll("button, [role='combobox'], [aria-haspopup='listbox'], .select2-selection, .dropdown-toggle, [class*='select'], input[readonly], div, span")
      );

      for (var i = 0; i < controls.length; i += 1) {
        var control = controls[i];
        if (!isVisible(control)) continue;

        var text = clean(control.innerText || control.textContent || control.getAttribute("value") || control.getAttribute("aria-label"));
        if (text !== wanted) continue;
        if (text.length > 80) continue;

        var context = clean(
          [
            control.closest("label") && control.closest("label").textContent || "",
            control.closest("tr") && control.closest("tr").textContent || "",
            control.closest("[role='row']") && control.closest("[role='row']").textContent || "",
            control.closest("li") && control.closest("li").textContent || "",
            control.closest("section") && control.closest("section").textContent || "",
            control.closest("fieldset") && control.closest("fieldset").textContent || "",
            control.closest("div") && control.closest("div").textContent || "",
            control.parentElement && control.parentElement.textContent || ""
          ].join(" ")
        );

        if (
          context.indexOf("document type") !== -1 ||
          context.indexOf("upload supporting documentation") !== -1 ||
          context.indexOf(".pdf") !== -1 ||
          context.indexOf("submit") !== -1
        ) {
          return true;
        }
      }

      return false;
    `,
    documentType
  ).catch(() => false);
}

async function clickCustomUploadedDocumentType(
  page: Page,
  documentType: string,
  fileName: string
) {
  const clickedControl = await evaluateInBrowser<{ x: number; y: number; text: string } | null>(
    page,
    `
      var fileName = String(arg.fileName || "").toLowerCase();
      var fileBase = fileName.replace(/\\.[a-z0-9]+$/i, "");
      var fileNeedles = [
        fileName,
        fileBase,
        fileBase.slice(0, 30),
        "glassguardian",
        "safelite-workorder",
        ".pdf"
      ].filter(function(item) {
        return item && item.length >= 4;
      });

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function display(value) {
        return String(value || "").replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var candidates = Array.prototype.slice.call(
        document.querySelectorAll("button, [role='combobox'], [aria-haspopup='listbox'], .select2-selection, .dropdown-toggle, [class*='select'], input[readonly], div, span")
      );
      var ranked = [];

      for (var i = 0; i < candidates.length; i += 1) {
        var node = candidates[i];
        if (!isVisible(node)) continue;

        var text = clean(node.innerText || node.textContent || node.getAttribute("value") || node.getAttribute("aria-label"));
        if (text !== "select") continue;

        var rect = node.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 10) continue;

        var context = clean(
          [
            node.id || "",
            node.getAttribute("name") || "",
            node.getAttribute("aria-label") || "",
            node.closest("label") && node.closest("label").textContent || "",
            node.closest("tr") && node.closest("tr").textContent || "",
            node.closest("[role='row']") && node.closest("[role='row']").textContent || "",
            node.closest("li") && node.closest("li").textContent || "",
            node.closest("section") && node.closest("section").textContent || "",
            node.closest("fieldset") && node.closest("fieldset").textContent || "",
            node.closest("div") && node.closest("div").textContent || "",
            node.parentElement && node.parentElement.textContent || ""
          ].join(" ")
        );

        var score = 0;
        if (context.indexOf("document type") !== -1) score += 100;
        if (context.indexOf("upload supporting documentation") !== -1) score += 40;
        if (context.indexOf(".pdf") !== -1) score += 40;
        for (var needleIndex = 0; needleIndex < fileNeedles.length; needleIndex += 1) {
          if (context.indexOf(fileNeedles[needleIndex]) !== -1) {
            score += 80;
            break;
          }
        }

        ranked.push({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          text: display(node.innerText || node.textContent || node.getAttribute("value") || node.getAttribute("aria-label")),
          score: score
        });
      }

      ranked.sort(function(a, b) {
        return b.score - a.score;
      });

      return ranked[0] || null;
    `,
    { documentType, fileName }
  ).catch(() => null);

  if (clickedControl) {
    await page.mouse.click(clickedControl.x, clickedControl.y).catch(() => {});
  } else {
    await page.getByText("Select", { exact: true }).last().click({ timeout: 10_000 });
  }

  await wait(600);

  const optionClicked = await page
    .getByText(documentType, { exact: true })
    .last()
    .click({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!optionClicked) {
    await page.keyboard.press("ArrowDown").catch(() => {});
    await wait(150);
    await page.keyboard.press("Enter").catch(() => {});
  }

  await wait(1000);
  await page.keyboard.press("Tab").catch(() => {});
  await wait(500);

  return await customUploadedDocumentTypeLooksCorrect(page, documentType);
}

async function forceSelectUploadedDocumentType(page: Page, documentType: string) {
  return await evaluateInBrowser<boolean>(
    page,
    `
      var wanted = String(arg || "").toLowerCase().replace(/\\s+/g, " ").trim();

      function clean(value) {
        return String(value || "").toLowerCase().replace(/\\s+/g, " ").trim();
      }

      function isVisible(node) {
        if (!node || !node.getBoundingClientRect) return false;
        var rect = node.getBoundingClientRect();
        var style = window.getComputedStyle(node);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.display !== "none" &&
          style.visibility !== "hidden"
        );
      }

      var selects = Array.prototype.slice.call(document.querySelectorAll("select"));
      var ranked = [];

      for (var selectIndex = 0; selectIndex < selects.length; selectIndex += 1) {
        var select = selects[selectIndex];
        if (!isVisible(select) || select.disabled) continue;

        var options = Array.prototype.slice.call(select.options);
        var match = options.find(function(option) {
          return clean(option.textContent).indexOf(wanted) !== -1;
        });

        if (!match) continue;

        var context = clean(
          [
            select.id || "",
            select.name || "",
            select.getAttribute("aria-label") || "",
            select.getAttribute("placeholder") || "",
            select.closest("label") && select.closest("label").textContent || "",
            select.closest("tr") && select.closest("tr").textContent || "",
            select.closest("[role='row']") && select.closest("[role='row']").textContent || "",
            select.closest("div") && select.closest("div").textContent || "",
            select.parentElement && select.parentElement.textContent || ""
          ].join(" ")
        );

        var score = 0;
        if (context.indexOf("document type") !== -1) score += 100;
        if (context.indexOf("supporting documentation") !== -1) score += 30;
        if (context.indexOf(".pdf") !== -1 || context.indexOf(".png") !== -1 || context.indexOf(".jpg") !== -1) score += 20;
        if (context.indexOf("work order") !== -1) score += 10;

        ranked.push({ select: select, option: match, score: score });
      }

      ranked.sort(function(a, b) {
        return b.score - a.score;
      });

      var winner = ranked[0];
      if (!winner) return false;

      winner.select.scrollIntoView({ block: "center", inline: "center" });
      winner.select.value = winner.option.value;
      winner.option.selected = true;
      winner.select.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      winner.select.dispatchEvent(new Event("input", { bubbles: true }));
      winner.select.dispatchEvent(new Event("change", { bubbles: true }));
      winner.select.dispatchEvent(new Event("blur", { bubbles: true }));

      return true;
    `,
    documentType
  );
}

async function selectDocumentType(page: Page, documentType: string) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const selected =
      (await selectUploadedDocumentTypeNative(page, documentType).catch(() => false)) ||
      (await forceSelectUploadedDocumentType(page, documentType).catch(() => false)) ||
      (await clickUploadedDocumentTypeLikeUser(page, documentType).catch(() => false)) ||
      (await selectFirst(page, ["Document Type", "Document type", "Type"], documentType).catch(() => false)) ||
      (await selectNativeOptionByText(page, documentType).catch(() => false)) ||
      (await selectOptionByText(page, documentType).catch(() => false));

    if (selected) {
      await page.keyboard.press("Enter").catch(() => {});
      await wait(250);
      await page.keyboard.press("Escape").catch(() => {});
      await wait(900);
      if (await documentTypeSelectionLooksCorrect(page, documentType)) return true;
    }

    await wait(1500);
  }

  return await documentTypeSelectionLooksCorrect(page, documentType);
}

async function uploadWorkOrder(
  page: Page,
  receiptPdfPath: string,
  documentType: string,
  hooks?: {
    log?: (message: string) => any | Promise<any>;
    capture?: (name: string) => any | Promise<any>;
  }
) {
  const log = async (message: string) => {
    await hooks?.log?.(message).catch(() => {});
  };

  const capture = async (name: string) => {
    await hooks?.capture?.(name).catch(() => {});
  };

  const receiptFileName = path.basename(receiptPdfPath);
  const fileInputCount = await page.locator('input[type="file"]').count().catch(() => 0);
  await log(`Found ${fileInputCount} Safelite file upload input(s).`);

  if (fileInputCount < 1) {
    await log("No Safelite file input was available on the upload page.");
    return false;
  }

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(receiptPdfPath);
  await log(`Set receipt PDF on Safelite file input: ${receiptFileName}.`);

  const rowReady = await waitForUploadedDocumentRow(page, receiptFileName);
  await log(
    rowReady
      ? `Uploaded document row appeared for ${receiptFileName}.`
      : `Uploaded document row was not confirmed for ${receiptFileName}; trying document type selection anyway.`
  );

  await wait(1500);
  await log(
    `Visible document type selects before selection: ${compactLogText(
      await summarizeVisibleDocumentTypeSelects(page)
    )}`
  );

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const customSelected = await clickCustomUploadedDocumentType(
      page,
      documentType,
      receiptFileName
    ).catch((e: any) => {
      void log(`Custom document type attempt ${attempt} failed: ${e?.message || e}`);
      return false;
    });

    if (customSelected) {
      await log(`Selected ${documentType} from Safelite custom document type dropdown.`);
      await capture("work-order-document-type-selected");
      return true;
    }

    const result = await setDocumentTypeOnUploadedRowSelect(
      page,
      documentType,
      receiptFileName
    ).catch((e: any) => ({
      ok: false,
      visibleSelectCount: 0,
      chosenIndex: null,
      chosenScore: 0,
      selectedText: "",
      optionTexts: [],
      context: "",
      reason: e?.message || "Document type selection script failed.",
    }));

    await log(
      result.ok
        ? `Selected ${documentType} on uploaded document select #${result.chosenIndex} (score ${result.chosenScore}).`
        : `Document type attempt ${attempt} did not stick: ${
            result.reason || `selected="${result.selectedText || "(blank)"}"`
          }`
    );

    if (result.optionTexts?.length) {
      await log(
        `Document type select #${result.chosenIndex ?? "?"} options: ${compactLogText(
          result.optionTexts.join(" | "),
          500
        )}`
      );
    }

    if (result.context) {
      await log(
        `Document type select #${result.chosenIndex ?? "?"} context: ${compactLogText(
          result.context,
          500
        )}`
      );
    }

    await wait(1000);

    if (result.ok && (await verifyUploadedDocumentTypeSelect(page, documentType, receiptFileName))) {
      await capture("work-order-document-type-selected");
      return true;
    }

    await wait(750);
  }

  await log(
    `Document type verification failed. Visible document type selects after attempts: ${compactLogText(
      await summarizeVisibleDocumentTypeSelects(page),
      900
    )}`
  );

  return false;
}

export async function runSafeliteBillingWorker(options: RunOptions) {
	  const {
	    jobId,
	    payload,
	    receiptPdfPath,
	    headless = false,
	    allowFinalSubmit = false,
	    keepBrowserOpenOnReady = false,
	    keepBrowserOpenOnFailure = false,
	    onLog,
	    onScreenshot,
	  } = options;

  const logs: any[] = [];
  const screenshots: any[] = [];

	  let browser: Browser | null = null;
	  let page: Page | null = null;
	  let keepBrowserOpen = false;

  async function pushLog(message: string) {
    const entry = nowLog(message);
    logs.push(entry);
    try {
      await onLog?.(entry);
    } catch {
      // Progress persistence should never stop the browser automation itself.
    }
    return entry;
  }

  async function capture(name: string) {
    if (!page) return null;
    const shot = await screenshot(page, jobId, name);
    let nextShot = shot;
    try {
      nextShot = (await onScreenshot?.(shot)) || shot;
    } catch {
      nextShot = shot;
    }
    screenshots.push(nextShot);
    return nextShot;
  }

  try {
    await pushLog("Preparing receipt PDF for upload.");

    const finalReceiptPdfPath =
      receiptPdfPath || (await ensureReceiptPdfInTmp(payload));

    await pushLog(`Receipt PDF ready at ${finalReceiptPdfPath}.`);
    await pushLog("Launching Safelite worker browser.");

    browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 150,
    });

    page = await browser.newPage({
      viewport: {
        width: 1440,
        height: 1000,
      },
    });

    await installBrowserEvaluateNameShim(page);

    await page.goto(payload.safeliteUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await installBrowserEvaluateNameShim(page);

    await wait(2500);

    await capture("opened-safelite");

    await pushLog("Safelite opened. Looking for Submit invoice path.");

    const submitInvoiceVisible = await page
      .getByText("Submit invoice", { exact: false })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!submitInvoiceVisible) {
      await capture("needs-login");
      await pushLog("Submit invoice path not visible. Login/session may be required.");

      return {
        ok: false,
        status: "needs_login",
        logs,
        screenshots,
      };
    }

    await pushLog("Clicking Submit invoice.");

    await clickButtonByText(page, "Submit invoice");
    await wait(2500);
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    await capture("submit-invoice-page");

    await pushLog("Filling shop number and referral number.");

    const filledShop = await fillFirst(
      page,
      ["Shop number", "Shop Number", "Shop"],
      payload.shopNumber
    );

    const filledReferral = await fillFirst(
      page,
      ["Referral number", "Referral Number", "Referral"],
      payload.referralNumber
    );

    if (!filledShop || !filledReferral) {
      await capture("missing-shop-or-referral-field");

      return {
        ok: false,
        status: "failed",
        error: "Could not find shop/referral fields.",
        logs,
        screenshots,
      };
    }

    await checkFirst(page, [
      "I acknowledge that I am a shop user",
      "I acknowledge",
      "shop user",
    ]);

    await capture("shop-referral-filled");

    await pushLog("Continuing to Create Invoice.");

    await clickButtonByText(page, "Continue");
    await wait(4000);
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    await capture("create-invoice-page-before-fill");

    await pushLog("Hard filling VIN, invoice number, install date, deductible, and signature.");

    const invoiceInfoFilled = await fillInvoiceInfo(page, payload);

    await capture("invoice-info-filled");

    if (!invoiceInfoFilled) {
      await pushLog("VIN filled / Invoice filled / Install date filled check failed.");
      return {
        ok: false,
        status: "failed",
        error: "Could not fill VIN, invoice number, or install date.",
        logs,
        screenshots,
      };
    }

    await pushLog("Moving to parts/labor page.");

    await clickButtonByText(page, "Next");
    await wait(4500);
    await page.waitForLoadState("domcontentloaded").catch(() => {});

    await capture("parts-page");

	    const billingAmountDollars = billingAmountFromPayload(payload);
	    await pushLog(`Selecting LABOR Part and entering insurance due amount $${billingAmountDollars}.`);

	    const laborFilled = await addLaborPart(page, billingAmountDollars);
	    const taxFilled = await fillSalesTaxZero(page);

	    await capture("labor-filled");

	    if (!laborFilled) {
	      return {
        ok: false,
        status: "failed",
        error: "Could not fill labor amount.",
        logs,
	        screenshots,
	      };
	    }

	    if (!taxFilled) {
	      return {
	        ok: false,
	        status: "failed",
	        error: "Could not fill required Safelite sales tax field.",
	        logs,
	        screenshots,
	      };
	    }

	    await pushLog("Moving to document upload page.");

	    await clickButtonByText(page, "Next");
	    await wait(4000);
	    await page.waitForLoadState("domcontentloaded").catch(() => {});

	    await capture("upload-page");

	    const partsErrors = await readSafeliteValidationErrors(page);
	    if (partsErrors.length > 0) {
	      await capture("parts-validation-errors");
        await pushLog(`Safelite validation errors: ${partsErrors.join(" | ")}`);
	      return {
	        ok: false,
	        status: "failed",
	        error: `Safelite rejected the parts/labor page: ${partsErrors.join(" ")}`,
	        logs,
	        screenshots,
	      };
	    }

	    const uploadReady =
	      (await page.locator('input[type="file"]').count().catch(() => 0)) > 0 ||
	      (await page
	        .getByText("Upload supporting documentation", { exact: false })
	        .first()
	        .isVisible({ timeout: 2500 })
	        .catch(() => false));

	    if (!uploadReady) {
	      await capture("upload-page-not-ready");
	      return {
	        ok: false,
	        status: "failed",
	        error: "Safelite did not advance to the document upload page.",
	        logs,
	        screenshots,
	      };
	    }

	    await pushLog("Uploading receipt PDF as Work Order.");

	    const workOrderUploaded = await uploadWorkOrder(
	      page,
	      finalReceiptPdfPath,
	      payload.documentType,
        {
          log: pushLog,
          capture,
        }
	    );

	    await capture("receipt-uploaded");

	    if (!workOrderUploaded) {
	      await capture("document-type-failed");
	      keepBrowserOpen = keepBrowserOpenOnFailure && !headless;
        await pushLog("Could not verify Work Order document type after upload.");
        if (keepBrowserOpen) {
          await pushLog("Browser left open for admin review after failure.");
        }
	      return {
	        ok: false,
	        status: "failed",
	        error: "Could not set uploaded document type to Work Order.",
	        logs,
	        screenshots,
          browserLeftOpen: keepBrowserOpen,
	      };
	    }

	    if (!allowFinalSubmit) {
	      keepBrowserOpen = keepBrowserOpenOnReady && !headless;
        await pushLog("All fields completed and receipt uploaded.");
        await pushLog("Final submit blocked because allowFinalSubmit=false.");
        if (keepBrowserOpen) {
          await pushLog("Browser left open for admin review and manual Submit.");
        }
	      return {
	        ok: true,
	        status: "ready_for_manual_submit",
	        logs,
	        screenshots,
	        browserLeftOpen: keepBrowserOpen,
	      };
	    }

    await pushLog("Submitting Safelite invoice.");
    await capture("before-final-submit");

	    await clickButtonByText(page, "Submit");
	    await wait(7000);
	    await page.waitForLoadState("domcontentloaded").catch(() => {});

      await capture("after-final-submit");
	    await capture("submitted");

	    let finalText = await page.locator("body").innerText().catch(() => "");
	    let submitErrors = await readSafeliteValidationErrors(page);

      const documentTypeRejected = submitErrors.some((line) =>
        String(line).toLowerCase().includes("document type")
      );

      if (documentTypeRejected) {
        await pushLog("Safelite asked for document type again; reselecting Work Order and retrying submit.");
        const retryCustomDocumentType = await clickCustomUploadedDocumentType(
          page,
          payload.documentType,
          path.basename(finalReceiptPdfPath)
        ).catch(() => false);

        const retryDocumentType = retryCustomDocumentType
          ? {
              ok: true,
              chosenIndex: null,
              reason: "",
              selectedText: payload.documentType,
            }
          : await setDocumentTypeOnUploadedRowSelect(
          page,
          payload.documentType,
          path.basename(finalReceiptPdfPath)
        ).catch((e: any) => ({
            ok: false,
            visibleSelectCount: 0,
            chosenIndex: null,
            chosenScore: 0,
            selectedText: "",
            optionTexts: [],
            context: "",
            reason: e?.message || "Document type retry failed.",
          }));

        await pushLog(
          retryDocumentType.ok
            ? retryCustomDocumentType
              ? `Reselected ${payload.documentType} from Safelite custom document type dropdown.`
              : `Reselected ${payload.documentType} on uploaded document select #${retryDocumentType.chosenIndex}.`
            : `Document type retry did not stick before final submit retry: ${
                retryDocumentType.reason || retryDocumentType.selectedText || "unknown"
              }`
        );

        if (!retryDocumentType.ok) {
          await selectDocumentType(page, payload.documentType);
        }

        await capture("document-type-reselected-before-submit");
        await capture("before-final-submit-retry");
        await clickButtonByText(page, "Submit");
        await wait(7000);
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await capture("after-final-submit-retry");
        await capture("submitted-after-document-type-retry");
        finalText = await page.locator("body").innerText().catch(() => "");
        submitErrors = await readSafeliteValidationErrors(page);
      }

      const postSubmitRequiredInfoReset = isPostSubmitRequiredInfoReset(finalText, submitErrors);
      if (postSubmitRequiredInfoReset) {
        await pushLog(
          "Safelite showed a post-submit required information reset page; treating as submitted because final submit completed."
        );
        submitErrors = [];
      }

	    if (submitErrors.length > 0) {
        await wait(500);
        const errorScreenshot =
          (await capture("final-submit-error").catch(() => null)) ||
          (await capture("submit-validation-errors").catch(() => null));
        if (errorScreenshot) {
          await pushLog(
            `Captured Safelite final submit error screenshot: ${
              errorScreenshot.name || "final-submit-error"
            }.`
          );
        }
	      keepBrowserOpen = keepBrowserOpenOnFailure && !headless;
        await pushLog(`Safelite final submit errors: ${submitErrors.join(" | ")}`);
        if (keepBrowserOpen) {
          await pushLog("Browser left open for admin review after failure.");
        }
	      return {
	        ok: false,
	        status: "failed",
	        error: `Safelite rejected final submit: ${submitErrors.join(" ")}`,
	        logs,
	        screenshots,
          browserLeftOpen: keepBrowserOpen,
	      };
	    }

	    const confirmationMatch = finalText.match(
	      /(?:confirmation|invoice)(?:\s+number|\s+#|[:#\s])+([A-Z0-9-]+)/i
	    );
      await pushLog(
        confirmationMatch?.[1]
          ? `Safelite invoice submitted. Confirmation: ${confirmationMatch[1]}.`
          : "Safelite invoice submitted."
      );

	    return {
	      ok: true,
	      status: "submitted",
	      confirmationNumber: confirmationMatch?.[1] ?? null,
	      logs,
	      screenshots,
	    };
  } catch (e: any) {
    if (page) {
      await capture("worker-error").catch(() => null);
    }
    keepBrowserOpen = keepBrowserOpenOnFailure && !headless && !!browser;
    await pushLog(e?.message || "Safelite worker failed.");
    if (keepBrowserOpen) {
      await pushLog("Browser left open for admin review after failure.");
    }

    return {
      ok: false,
      status: "failed",
      error: e?.message || "Safelite worker failed.",
      logs,
      screenshots: screenshots.filter(Boolean),
      browserLeftOpen: keepBrowserOpen,
    };
	  } finally {
	    if (browser && !keepBrowserOpen) {
	      await browser.close().catch(() => {});
	    }
	  }
}
