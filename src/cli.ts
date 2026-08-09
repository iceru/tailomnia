#!/usr/bin/env node

import { Command } from "commander";
import { makeCpt } from "./commands/make-cpt.js";
import { createProject } from "./commands/create.js";

const program = new Command();

program
    .name("tailomnia")
    .description("CLI helper for TailPress + ACF")
    .version("0.1.0");

program
    .command("make:cpt")
    .description("Generate a WordPress custom post type")
    .action(makeCpt);

program
    .command("create [name]")
    .description("Create a new Tailomnia project")
    .action(createProject);

program.parse();