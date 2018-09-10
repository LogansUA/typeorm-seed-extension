#!/usr/bin/env node

import * as Chalk from "chalk";
import * as commander from "commander";
import * as path from "path";

import { loadEntityFactories, loadSeeds, runSeed, setConnection } from "./seed";
import { getConnection } from "./seed/connection";

// TODO: After TS update to 2.9 we can safely use import statement, until then this is the most easies way to use json
/* tslint:disable-next-line:no-var-requires */
const pkg = require("../package");

// Cli helper
commander
    .name(pkg.name)
    .version(pkg.version)
    .description(pkg.description)
    .option("-L, --logging", "enable sql query logging")
    .option("--factories <path>", "add filepath for your factories")
    .option("--seeds <path>", "add filepath for your seeds")
    .option("--run <seeds>", "run specific seeds (file names without extension)", (val: string) => val.split(","))
    .option("--config <file>", "path to your ormconfig.json file (must be a json)")
    .parse(process.argv);

// Get cli parameter for a different factory path
const factoryPath = (commander.factories)
    ? commander.factories
    : "src/database/";

// Get cli parameter for a different seeds path
const seedsPath = (commander.seeds)
    ? commander.seeds
    : "src/database/seeds/";

// Get a list of seeds
const listOfSeeds = (commander.run)
    ? commander.run.map(l => l.trim()).filter(l => l.length > 0)
    : [];

// Search for seeds and factories
const run = async () => {
    const log = console.log;
    const chalk = Chalk.default;

    let factoryFiles;
    let seedFiles;
    try {
        factoryFiles = await loadEntityFactories(factoryPath);
        seedFiles = await loadSeeds(seedsPath);
    } catch (error) {
        return handleError(error);
    }

    // Filter seeds
    if (listOfSeeds.length > 0) {
        seedFiles = seedFiles.filter(sf => listOfSeeds.indexOf(path.basename(sf).replace(".ts", "")) >= 0);
    }

    // Get database connection and pass it to the seeder
    let connection;
    try {
        connection = await getConnection();

        setConnection(connection);
    } catch (error) {
        return handleError(error);
    }

    // Status logging to print out the amount of factories and seeds.
    log(chalk.bold("seeds"));
    log(
        "🔎 ",
        chalk.gray.underline(`found:`),
        chalk.blue.bold(`${factoryFiles.length} factories`, chalk.gray("&"), chalk.blue.bold(`${seedFiles.length} seeds`)),
    );

    // Show seeds in the console
    for (const seedFile of seedFiles) {
        try {
            const className = seedFile.split("/")[seedFile.split("/").length - 1];

            log("\n" + chalk.gray.underline(`executing seed:`), chalk.green.bold(`${className}`));

            const seedFileObject: any = require(seedFile);
            const classes = Object.keys(seedFileObject);

            if (classes.length > 1) {
                throw new Error("Too many objects in seed file! Should be only one class!");
            }

            const [classObject] = classes;

            await runSeed(seedFileObject[classObject]);
        } catch (error) {
            console.error("Could not run seed ", error);

            process.exit(1);
        }
    }

    log("\n👍 ", chalk.gray.underline(`finished seeding`));
    process.exit(0);
};

const handleError = (error) => {
    console.error(error);
    process.exit(1);
};

run();
