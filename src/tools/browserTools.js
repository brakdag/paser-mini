import { chromium } from "playwright";

export default class BrowserTools {
  _browser = null;
  _context = null;
  _page = null;

  _IPHONE_MINI_CONFIG = {
    viewport: { width: 360, height: 780 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  };

  async ensureBrowser() {
    if (!this._browser) {
      this._browser = await chromium.launch({ headless: true });
      this._context = await this._browser.newContext(this._IPHONE_MINI_CONFIG);
      this._page = await this._context.newPage();
    }
  }

  async _cleanPage() {
    try {
      await this._page.addStyleTag({
        content: ".modal, .popup, .overlay, [class*='modal'], [class*='popup'], [class*='overlay'], [id*='modal'], [id*='popup'], [id*='overlay'], .cookie-banner, .cookie-consent { display: none !important; visibility: hidden !important; pointer-events: none !important; }",
      });
    } catch (e) {
      // Silently fail
    }
  }

  async interact({ url, action, params = {} }) {
    await this.ensureBrowser();
    try {
      switch (action) {
        case "navigate":
          if (!url) return "ERR: URL is required";
          await this._page.goto(url, { waitUntil: "networkidle" });
          await this._cleanPage();
          return "Page loaded and cleaned.";
        case "screenshot":
          const path = `screenshot_${Date.now()}.png`;
          await this._page.screenshot({ path });
          return `Screenshot saved to ${path}`;
        case "click":
          if (!params.selector) return "ERR: Selector required";
          await this._page.click(params.selector);
          return "Element clicked.";
        case "type":
          if (!params.selector || !params.text) return "ERR: Selector/text required";
          await this._page.fill(params.selector, params.text);
          if (params.pressEnter) await this._page.keyboard.press("Enter");
          return "Text entered.";
        case "scroll":
          if (!params.direction) return "ERR: Direction required";
          const amount = params.amount || 500;
          const scrollY = params.direction === "down" ? amount : -amount;
          await this._page.evaluate((y) => window.scrollBy(0, y), scrollY);
          return `Scrolled ${params.direction}.`;
        case "inspect":
          const acc = await this._page.accessibility.snapshot();
          return JSON.stringify(acc, null, 2);
        default:
          return "ERR: Unknown action";
      }
    } catch (e) {
      return `ERR: ${e.message}`;
    }
