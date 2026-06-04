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
      this._browser = await chromium.launch({
        headless: true,
        executablePath: '/usr/bin/google-chrome',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this._context = await this._browser.newContext(this._IPHONE_MINI_CONFIG);
      this._page = await this._context.newPage();
    }
  }

  async _cleanPage() {
    try {
      const styles = ".modal, .popup, .overlay, [class*='modal'], [class*='popup'], [class*='overlay'], " +
                     "[id*='modal'], [id*='popup'], [id*='overlay'], .cookie-banner, .cookie-consent " +
                     "{ display: none !important; visibility: hidden !important; pointer-events: none !important; }";
      await this._page.addStyleTag({
        content: styles,
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
          if (!url) return JSON.stringify({ status: "error", message: "URL is required" });
          await this._page.goto(url, { waitUntil: "networkidle" });
          await this._cleanPage();
          return JSON.stringify({ status: "success", message: "Page loaded and cleaned." });
        case "screenshot": {
          const path = `screenshot_${Date.now()}.jpg`;
          await this._page.screenshot({ path, type: "jpeg" });
          return JSON.stringify({ status: "success", message: `Screenshot saved to ${path}` });
        }
        case "click":
          if (!params.selector) return JSON.stringify({ status: "error", message: "Selector required" });
          await this._page.click(params.selector);
          return JSON.stringify({ status: "success", message: "Element clicked." });
        case "type":
          if (!params.selector || !params.text) return JSON.stringify({ status: "error", message: "Selector/text required" });
          await this._page.fill(params.selector, params.text);
          if (params.pressEnter) await this._page.keyboard.press("Enter");
          return JSON.stringify({ status: "success", message: "Text entered." });
        case "scroll": {
          if (!params.direction) return JSON.stringify({ status: "error", message: "Direction required" });
          const amount = params.amount || 500;
          const scrollY = params.direction === "down" ? amount : -amount;
          // eslint-disable-next-line no-undef
          await this._page.evaluate((y) => window.scrollBy(0, y), scrollY);
          return JSON.stringify({ status: "success", message: `Scrolled ${params.direction}.` });
        }
        case "inspect": {
          const acc = await this._page.accessibility.snapshot();
          return JSON.stringify({ status: "success", data: acc });
        }
        default:
          return JSON.stringify({ status: "error", message: "Unknown action" });
      }
    } catch (e) {
      return JSON.stringify({ status: "error", message: e.message });
    }
  }
}