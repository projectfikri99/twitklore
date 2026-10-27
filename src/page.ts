import { Page } from "@playwright/test";
import chalkPkg from "chalk";
const chalk = (chalkPkg as any).default ?? chalkPkg;

/** Blokir aset berat supaya hemat bandwidth & CPU (penting di Colab). */
export async function blockMedia(page: Page) {
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.includes(".jpg") || url.includes(".png") || url.includes(".mp4") || url.includes("format=jpg")) {
      return route.abort();
    }
    return route.continue();
  });
}

export async function scrollToBottom(page: Page) {
  await page.evaluate(() => window.scrollTo({ behavior: "smooth", top: document.body.scrollHeight }));
  // buang node foto biar DOM nggak makin berat tiap scroll
  await page.evaluate(() => {
    for (const sel of ["a div[data-testid='tweetPhoto']", "a div[aria-label='Image']", "div[data-testid='tweetPhoto']"]) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }
  });
}

export async function scrollToTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ behavior: "smooth", top: 0 }));
}

export const log = (msg: string) => console.info(chalk.blue(msg));
export const logWarn = (msg: string) => console.info(chalk.yellow(msg));
export const logError = (msg: unknown) => console.error(chalk.red(String(msg)));
