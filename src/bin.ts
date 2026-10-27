#!/usr/bin/env node
import { Command, Option } from "commander";
import prompts from "prompts";
import chalkPkg from "chalk";
const chalk = (chalkPkg as any).default ?? chalkPkg;
import { collect } from "./collect.js";
import type { PromptObject } from "prompts";

const program = new Command();

program
  .name("twitklore")
  .description("Kolektor tweet untuk keperluan akademik dan riset pribadi")
  .version("1.0.0")
  .addOption(new Option("-t, --token <value>", "Twitter auth_token cookie"))
  .addOption(new Option("-s, --search <value>", "Keyword pencarian"))
  .addOption(new Option("--thread <value>", "URL tweet thread (mode detail)"))
  .addOption(new Option("-f, --from <value>", "Tanggal mulai (DD-MM-YYYY)"))
  .addOption(new Option("--to <value>", "Tanggal akhir (DD-MM-YYYY)"))
  .addOption(new Option("-l, --limit <n>", "Jumlah tweet target").argParser(Number).default(10))
  .addOption(new Option("-d, --delay <n>", "Delay per tweet (detik)").argParser(Number).default(3))
  .addOption(new Option("-o, --output <value>", "Nama file output"))
  .addOption(new Option("--tab <value>", "Tab pencarian").choices(["TOP", "LATEST"]).default("LATEST"))
  .addOption(new Option("-e, --export <value>", "Format export").choices(["csv", "xlsx"]).default("csv"))
  .addOption(new Option("--headed", "Tampilkan browser (bukan headless)"))
  .addOption(new Option("--insert <value>", "Mode insert").choices(["REPLACE", "APPEND"]).default("REPLACE"));

async function main() {
  program.parse();
  const o = program.opts();

  console.log(chalk.bold.green("\ntwitklore v1.0.0"));
  console.log(chalk.gray("Derivative of tweet-harvest by Helmi Satria — see NOTICE"));
  console.log(chalk.gray("Untuk keperluan akademik dan riset pribadi saja.\n"));

  const answers: Record<string, any> = {};
  const questions: PromptObject<string>[] = [];

  if (!o.token) {
    questions.push({
      type: "password",
      name: "token",
      message: "Twitter auth_token cookie:",
      validate: (v: string) => (v.length >= 30 ? true : "Token terlalu pendek — auth_token biasanya 40+ karakter"),
    });
  }
  if (!o.search && !o.thread) {
    questions.push({
      type: "text",
      name: "search",
      message: "Keyword pencarian:",
      validate: (v: string) => (v.length > 0 ? true : "Wajib diisi"),
    });
  }

  if (questions.length) {
    const res = await prompts(questions, {
      onCancel: () => {
        console.log("Dibatalkan.");
        process.exit(0);
      },
    });
    Object.assign(answers, res);
  }

  await collect({
    authToken: o.token || answers.token,
    keywords: o.search || answers.search,
    threadUrl: o.thread,
    fromDate: o.from,
    toDate: o.to,
    limit: o.limit,
    delayPerTweet: o.delay,
    outputName: o.output,
    tab: (o.tab as string).toUpperCase() as "TOP" | "LATEST",
    format: o.export as "csv" | "xlsx",
    insertMode: o.insert as "REPLACE" | "APPEND",
    headless: !o.headed,
  });
}

main();
