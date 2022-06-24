const puppeteer = require('puppeteer'); // v13.0.0 or later

(async () => {
  const options = {
    width: 1200,
    height: 800,
  }
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: options.width, height: options.width },
    args: [`--window-size=${options.width},${options.height}`]
  });
  const page = await browser.newPage();
  const timeout = 5000;
  page.setDefaultTimeout(timeout);

  async function waitForSelectors(selectors, frame, options) {
    for (const selector of selectors) {
      try {
        return await waitForSelector(selector, frame, options);
      } catch (err) {
        console.error(err);
      }
    }
    throw new Error('Could not find element for selectors: ' + JSON.stringify(selectors));
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function scrollIntoViewIfNeeded(element, timeout) {
    await waitForConnected(element, timeout);
    const isInViewport = await element.isIntersectingViewport({ threshold: 0 });
    if (isInViewport) {
      return;
    }
    await element.evaluate(element => {
      element.scrollIntoView({
        block: 'center',
        inline: 'center',
        behavior: 'auto',
      });
    });
    await waitForInViewport(element, timeout);
  }

  async function waitForConnected(element, timeout) {
    await waitForFunction(async () => {
      return await element.getProperty('isConnected');
    }, timeout);
  }

  async function waitForInViewport(element, timeout) {
    await waitForFunction(async () => {
      return await element.isIntersectingViewport({ threshold: 0 });
    }, timeout);
  }

  async function waitForSelector(selector, frame, options) {
    if (!Array.isArray(selector)) {
      selector = [selector];
    }
    if (!selector.length) {
      throw new Error('Empty selector provided to waitForSelector');
    }
    let element = null;
    for (let i = 0; i < selector.length; i++) {
      const part = selector[i];
      if (element) {
        element = await element.waitForSelector(part, options);
      } else {
        element = await frame.waitForSelector(part, options);
      }
      if (!element) {
        throw new Error('Could not find element: ' + selector.join('>>'));
      }
      if (i < selector.length - 1) {
        element = (await element.evaluateHandle(el => el.shadowRoot ? el.shadowRoot : el)).asElement();
      }
    }
    if (!element) {
      throw new Error('Could not find element: ' + selector.join('|'));
    }
    return element;
  }

  async function waitForElement(step, frame, timeout) {
    const count = step.count || 1;
    const operator = step.operator || '>=';
    const comp = {
      '==': (a, b) => a === b,
      '>=': (a, b) => a >= b,
      '<=': (a, b) => a <= b,
    };
    const compFn = comp[operator];
    await waitForFunction(async () => {
      const elements = await querySelectorsAll(step.selectors, frame);
      return compFn(elements.length, count);
    }, timeout);
  }

  async function querySelectorsAll(selectors, frame) {
    for (const selector of selectors) {
      const result = await querySelectorAll(selector, frame);
      if (result.length) {
        return result;
      }
    }
    return [];
  }

  async function querySelectorAll(selector, frame) {
    if (!Array.isArray(selector)) {
      selector = [selector];
    }
    if (!selector.length) {
      throw new Error('Empty selector provided to querySelectorAll');
    }
    let elements = [];
    for (let i = 0; i < selector.length; i++) {
      const part = selector[i];
      if (i === 0) {
        elements = await frame.$$(part);
      } else {
        const tmpElements = elements;
        elements = [];
        for (const el of tmpElements) {
          elements.push(...(await el.$$(part)));
        }
      }
      if (elements.length === 0) {
        return [];
      }
      if (i < selector.length - 1) {
        const tmpElements = [];
        for (const el of elements) {
          const newEl = (await el.evaluateHandle(el => el.shadowRoot ? el.shadowRoot : el)).asElement();
          if (newEl) {
            tmpElements.push(newEl);
          }
        }
        elements = tmpElements;
      }
    }
    return elements;
  }

  async function waitForFunction(fn, timeout) {
    let isActive = true;
    setTimeout(() => {
      isActive = false;
    }, timeout);
    while (isActive) {
      const result = await fn();
      if (result) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Timed out');
  }
  {
    const targetPage = page;
    await targetPage.setViewport({ "width": options.width, "height": options.height })
  }
  {
    const timeout = 10000;
    const targetPage = page;
    const promises = [];
    promises.push(targetPage.waitForNavigation());
    await targetPage.goto("https://intranet.able-group.de/index.action");
    await Promise.all(promises);
  }
  {
    const targetPage = page;
    const element = await waitForSelectors([["#search-ui"]], targetPage, { timeout, visible: true });
    await scrollIntoViewIfNeeded(element, timeout);
    await element.click({ offset: { x: 13, y: 9 } });
    // warte bitte
    await page.screenshot({
      path: `${Date.now()}_searchUI.png`,
      fullPage: true
    })
  }
  {
    const targetPage = page;
    const element = await waitForSelectors([["#search-filter-input"]], targetPage, { timeout, visible: true });
    await scrollIntoViewIfNeeded(element, timeout);
    await element.click({ offset: { x: 105, y: 1 } });
  }
  {
    const timeout = 10000;
    const targetPage = page;
    await waitForElement({ "type": "waitForElement", "timeout": 10000, "selectors": ["body"] }, targetPage, timeout);
  }
  {
    const targetPage = page;
    const element = await waitForSelectors([["#search-filter-input"]], targetPage, { timeout, visible: true });
    await scrollIntoViewIfNeeded(element, timeout);
    const type = await element.evaluate(el => el.type);
    if (["textarea", "select-one", "text", "url", "tel", "search", "password", "number", "email"].includes(type)) {
      await element.type("marc");
    } else {
      await element.focus();
      await element.evaluate((el, value) => {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, "marc");
    }
    await waitForSelectors([["#search-result-container"]], targetPage, { timeout, visible: true });
    await page.screenshot({
      path: `${Date.now()}_searchResult.png`,
      fullPage: true
    })
    await sleep(2000)
  }
  {
    const targetPage = page;
    await targetPage.keyboard.down("Enter");
  }
  {
    const targetPage = page;
    await targetPage.keyboard.up("Enter");
  }

  await browser.close();
})();
