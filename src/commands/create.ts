import path from "node:path";
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";

import { commandExists } from "../utils/command-exists.js";
import {
    getSpawnCommand,
    runCommand,
} from "../utils/process.js";
import { setupTailomnia } from "../setup/tailomnia.js";
import {
    isWordPressProject,
    isWordPressInstalled,
} from "../utils/wordpress.js";
import { setupWordPress } from "../setup/wordpress.js";

interface WordPressInstallOptions {
    dbName: string;
    dbUser: string;
    dbPassword: string;
    dbHost: string;
    siteUrl: string;
    siteTitle: string;
    adminUser: string;
    adminPassword: string;
    adminEmail: string;
}

export async function createProject(
    name?: string
) {
    console.clear();

    p.intro("Tailomnia");

    let projectName = name;

    if (!projectName) {
        const result = await p.text({
            message: "Project name?",
            placeholder: "company-profile",

            validate(value) {
                if (!value || !value.trim()) {
                    return "Project name is required";
                }

                if (
                    !/^[a-zA-Z0-9-_]+$/.test(value)
                ) {
                    return "Use letters, numbers, - or _";
                }
            },
        });

        if (p.isCancel(result)) {
            p.cancel("Cancelled");
            return;
        }

        projectName = String(result);
    }

    const projectPath = path.resolve(
        process.cwd(),
        projectName
    );

    if (await pathExists(projectPath)) {
        p.log.error(
            `Directory "${projectName}" already exists.`
        );

        return;
    }

    const requirementsReady =
        await checkRequirements();

    if (!requirementsReady) {
        return;
    }

    const wordpressOptions =
        await promptForWordPressOptions(
            projectName
        );

    if (wordpressOptions === null) {
        return;
    }

    try {
        const tailPressTarget =
            wordpressOptions
                ? path
                      .join(
                          projectName,
                          "wp-content",
                          "themes",
                          projectName
                      )
                      .replace(/\\/g, "/")
                : projectName;

        if (wordpressOptions) {
            await installWordPress({
                projectPath,
                options: wordpressOptions,
            });
        }

        p.log.step(
            "Starting TailPress installer..."
        );

        await runCommand(
            "tailpress",
            [
                "new",
                tailPressTarget,
                "--no-interaction",
            ],
            process.cwd()
        );

        const themePath =
            await resolveThemePath(
                projectPath,
                projectName
            );

        if (!themePath) {
            p.log.warning(
                "TailPress project created, but Tailomnia could not automatically find the generated theme."
            );

            p.outro(
                "Project created without Tailomnia initialization."
            );

            return;
        }

        p.log.success(
            `Theme found: ${themePath}`
        );

        await setupTailomnia(themePath);

        p.log.success(
            "Tailomnia initialized"
        );

        await setupWordPressIfAvailable({
            projectPath,
            themePath,
        });

        p.note(
            [
                `Project: ${projectName}`,
                `Theme: ${themePath}`,
                "",
                "Next:",
                `cd ${projectName}`,
            ].join("\n"),
            "Project ready"
        );

        p.outro("Done");
    } catch (error) {
        p.log.error(
            error instanceof Error
                ? error.message
                : "Project creation failed"
        );
    }
}

async function promptForWordPressOptions(
    projectName: string
): Promise<WordPressInstallOptions | null | false> {
    const shouldInstall =
        await p.confirm({
            message:
                "Install WordPress as well?",
            initialValue: false,
        });

    if (p.isCancel(shouldInstall)) {
        p.cancel("Cancelled");
        return null;
    }

    if (!shouldInstall) {
        return false;
    }

    if (!(await ensureWpCli())) {
        return null;
    }

    const defaultDbName =
        projectName.replace(/-/g, "_");
    const defaultSiteUrl = `http://${projectName}.local`;
    const defaultSiteTitle =
        titleCase(projectName);

    const dbName = await textPrompt({
        message: "Database name?",
        defaultValue: defaultDbName,
        validate(value) {
            if (!/^[a-zA-Z0-9_]+$/.test(value)) {
                return "Use letters, numbers, and underscores.";
            }
        },
    });

    if (dbName === null) {
        return null;
    }

    const dbUser = await textPrompt({
        message: "Database user?",
        defaultValue: "root",
    });

    if (dbUser === null) {
        return null;
    }

    const dbPassword =
        await passwordPrompt({
            message: "Database password?",
        });

    if (dbPassword === null) {
        return null;
    }

    const dbHost = await textPrompt({
        message: "Database host?",
        defaultValue: "127.0.0.1",
    });

    if (dbHost === null) {
        return null;
    }

    const siteUrl = await textPrompt({
        message: "Site URL?",
        defaultValue: defaultSiteUrl,
    });

    if (siteUrl === null) {
        return null;
    }

    const siteTitle = await textPrompt({
        message: "Site title?",
        defaultValue: defaultSiteTitle,
    });

    if (siteTitle === null) {
        return null;
    }

    const adminUser = await textPrompt({
        message: "Admin username?",
        defaultValue: "admin",
    });

    if (adminUser === null) {
        return null;
    }

    const adminPassword =
        await passwordPrompt({
            message: "Admin password?",
            validate(value) {
                if (!value) {
                    return "Admin password is required.";
                }
            },
        });

    if (adminPassword === null) {
        return null;
    }

    const adminEmail = await textPrompt({
        message: "Admin email?",
        defaultValue: "admin@example.com",
        validate(value) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return "Enter a valid email address.";
            }
        },
    });

    if (adminEmail === null) {
        return null;
    }

    return {
        dbName,
        dbUser,
        dbPassword,
        dbHost,
        siteUrl,
        siteTitle,
        adminUser,
        adminPassword,
        adminEmail,
    };
}

async function ensureWpCli(): Promise<boolean> {
    if (commandExists("wp")) {
        p.log.success("WP-CLI found");
        return true;
    }

    p.log.warning("WP-CLI is not installed.");

    const useHomebrew = commandExists("brew");
    let installerName = useHomebrew
        ? "Homebrew"
        : "Composer";

    const install = await p.confirm({
        message: `Install WP-CLI with ${installerName}?`,
        initialValue: true,
    });

    if (p.isCancel(install)) {
        p.cancel("Cancelled");
        return false;
    }

    if (!install) {
        p.log.info(
            "WP-CLI is required to install WordPress."
        );
        return false;
    }

    p.log.step("Installing WP-CLI...");

    try {
        if (useHomebrew) {
            await runCommand("brew", [
                "install",
                "wp-cli",
            ], undefined, {
                HOMEBREW_NO_AUTO_UPDATE: "1",
            });
        } else {
            await installWpCliWithComposer();
        }
    } catch (error) {
        p.log.error(
            error instanceof Error
                ? error.message
                : "WP-CLI installation failed."
        );

        if (!useHomebrew) {
            return false;
        }

        p.log.warning(
            "Homebrew could not install WP-CLI. Tailomnia will not change tap trust settings."
        );

        const tryComposer = await p.confirm({
            message: "Try installing WP-CLI with Composer instead?",
            initialValue: true,
        });

        if (p.isCancel(tryComposer)) {
            p.cancel("Cancelled");
            return false;
        }

        if (!tryComposer) {
            return false;
        }

        installerName = "Composer";

        try {
            await installWpCliWithComposer();
        } catch (composerError) {
            p.log.error(
                composerError instanceof Error
                    ? composerError.message
                    : "WP-CLI installation failed."
            );
            return false;
        }
    }

    if (!commandExists("wp")) {
        p.log.error(
            "WP-CLI was installed, but the command is not available in PATH."
        );
        p.log.info(
            `Add the ${installerName} binary directory to PATH and try again.`
        );
        return false;
    }

    p.log.success("WP-CLI installed");
    return true;
}

async function installWpCliWithComposer(): Promise<void> {
    await runCommand("composer", [
        "global",
        "require",
        "wp-cli/wp-cli-bundle",
        "--with-all-dependencies",
    ]);
}

async function installWordPress({
    projectPath,
    options,
}: {
    projectPath: string;
    options: WordPressInstallOptions;
}) {
    p.log.step(
        "Installing WordPress..."
    );

    await fs.mkdir(projectPath, {
        recursive: true,
    });

    await runWpCommand(
        ["core", "download"],
        projectPath
    );

    await runWpCommand(
        [
            "config",
            "create",
            `--dbname=${options.dbName}`,
            `--dbuser=${options.dbUser}`,
            `--dbpass=${options.dbPassword}`,
            `--dbhost=${options.dbHost}`,
        ],
        projectPath
    );

    await prepareDatabase(
        projectPath,
        options.dbHost
    );

    await runWpCommand(
        [
            "core",
            "install",
            `--url=${options.siteUrl}`,
            `--title=${options.siteTitle}`,
            `--admin_user=${options.adminUser}`,
            `--admin_password=${options.adminPassword}`,
            `--admin_email=${options.adminEmail}`,
        ],
        projectPath
    );

    p.log.success(
        "WordPress installed"
    );
}

async function prepareDatabase(
    projectPath: string,
    dbHost: string
): Promise<void> {
    try {
        await runWpCommand(
            ["db", "create"],
            projectPath
        );
        return;
    } catch {
        try {
            await runWpCommand(
                ["db", "check"],
                projectPath
            );
            p.log.info("Using existing database");
            return;
        } catch {
            // Offer local service recovery below.
        }
    }

    const databaseStarted =
        await offerToStartLocalDatabase(dbHost);

    if (!databaseStarted) {
        throw new Error(
            "A running MySQL-compatible database is required to install WordPress."
        );
    }

    await new Promise((resolve) =>
        setTimeout(resolve, 1000)
    );

    try {
        await runWpCommand(
            ["db", "create"],
            projectPath
        );
    } catch {
        await runWpCommand(
            ["db", "check"],
            projectPath
        );
        p.log.info("Using existing database");
    }
}

async function offerToStartLocalDatabase(
    dbHost: string
): Promise<boolean> {
    const normalizedHost =
        dbHost.trim().toLowerCase();
    const host = normalizedHost.startsWith("[")
        ? normalizedHost.slice(
              1,
              normalizedHost.indexOf("]")
          )
        : normalizedHost === "::1"
          ? normalizedHost
          : normalizedHost.split(":")[0];
    const isLocal = [
        "localhost",
        "127.0.0.1",
        "::1",
    ].includes(host ?? "");

    if (!isLocal) {
        p.log.error(
            `Could not connect to the database at ${dbHost}. Start that database server and try again.`
        );
        return false;
    }

    if (!commandExists("brew")) {
        p.log.error(
            "No local database server is reachable. Start MySQL or MariaDB and try again."
        );
        return false;
    }

    let formula = ["mysql", "mariadb"].find(
        isHomebrewFormulaInstalled
    );

    if (!formula) {
        const install = await p.confirm({
            message: "Install and start MySQL with Homebrew?",
            initialValue: true,
        });

        if (p.isCancel(install)) {
            p.cancel("Cancelled");
            return false;
        }

        if (!install) {
            return false;
        }

        formula = "mysql";
        p.log.step("Installing MySQL...");
        await runCommand(
            "brew",
            ["install", formula],
            undefined,
            { HOMEBREW_NO_AUTO_UPDATE: "1" }
        );
    } else {
        const start = await p.confirm({
            message: `Start ${formula} with Homebrew?`,
            initialValue: true,
        });

        if (p.isCancel(start)) {
            p.cancel("Cancelled");
            return false;
        }

        if (!start) {
            return false;
        }
    }

    p.log.step(`Starting ${formula}...`);
    await runCommand(
        "brew",
        ["services", "start", formula],
        undefined,
        { HOMEBREW_NO_AUTO_UPDATE: "1" }
    );
    p.log.success(`${formula} started`);
    return true;
}

function isHomebrewFormulaInstalled(
    formula: string
): boolean {
    const spawnCommand = getSpawnCommand(
        "brew",
        ["list", "--versions", formula]
    );
    const result = spawnSync(
        spawnCommand.command,
        spawnCommand.args,
        {
            stdio: "ignore",
            env: {
                ...process.env,
                HOMEBREW_NO_AUTO_UPDATE: "1",
            },
        }
    );

    return result.status === 0;
}

async function runWpCommand(
    args: string[],
    cwd: string
): Promise<void> {
    const existingPhpArgs =
        process.env.WP_CLI_PHP_ARGS?.trim();
    const phpArgs = [
        existingPhpArgs,
        "-d memory_limit=512M",
    ]
        .filter(Boolean)
        .join(" ");

    await runCommand("wp", args, cwd, {
        WP_CLI_PHP_ARGS: phpArgs,
    });
}

async function setupWordPressIfAvailable({
    projectPath,
    themePath,
}: {
    projectPath: string;
    themePath: string;
}) {
    const hasWordPress =
        await isWordPressProject(
            projectPath
        );

    if (!hasWordPress) {
        if (
            isThemeInsideWordPressTree(
                projectPath,
                themePath
            )
        ) {
            p.log.warning(
                "The theme was created inside wp-content/themes, but WordPress files were not installed. TailPress may have failed during its WordPress step."
            );

            return;
        }

        p.log.info(
            "WordPress installation not detected. Skipping WordPress setup."
        );

        return;
    }

    p.log.success(
        "WordPress detected"
    );

    if (!commandExists("wp")) {
        p.log.warning(
            "WP-CLI is not installed. Skipping automatic ACF and theme setup."
        );

        return;
    }

    p.log.success(
        "WP-CLI found"
    );

    if (
        !isWordPressInstalled(projectPath)
    ) {
        p.log.info(
            "WordPress files exist, but WordPress is not installed in the database yet."
        );

        return;
    }

    p.log.success(
        "WordPress installation ready"
    );

    const shouldInstallAcf =
        await p.confirm({
            message: "Install ACF?",
            initialValue: true,
        });

    if (p.isCancel(shouldInstallAcf)) {
        p.cancel("Cancelled");
        return;
    }

    await setupWordPress({
        projectPath,
        themeSlug:
            path.basename(themePath),
        installAcf:
            Boolean(shouldInstallAcf),
    });
}

async function textPrompt({
    message,
    defaultValue,
    validate,
}: {
    message: string;
    defaultValue: string;
    validate?: (value: string) => string | undefined;
}): Promise<string | null> {
    const result = await p.text({
        message,
        initialValue: defaultValue,
        validate(value) {
            const finalValue =
                value?.trim() || defaultValue;

            return validate
                ? validate(finalValue)
                : undefined;
        },
    });

    if (p.isCancel(result)) {
        p.cancel("Cancelled");
        return null;
    }

    return String(result).trim() || defaultValue;
}

async function passwordPrompt({
    message,
    defaultValue,
    validate,
}: {
    message: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
}): Promise<string | null> {
    const result = await p.password({
        message,
        validate(value) {
            const finalValue =
                value || defaultValue || "";

            return validate
                ? validate(finalValue)
                : undefined;
        },
    });

    if (p.isCancel(result)) {
        p.cancel("Cancelled");
        return null;
    }

    return String(result) || defaultValue || "";
}

function titleCase(value: string): string {
    return value
        .split(/[-_]/g)
        .filter(Boolean)
        .map(
            (part) =>
                part.charAt(0).toUpperCase() +
                part.slice(1)
        )
        .join(" ");
}

function isThemeInsideWordPressTree(
    projectPath: string,
    themePath: string
): boolean {
    const relativeThemePath = path.relative(
        projectPath,
        themePath
    );

    const parts = relativeThemePath.split(
        path.sep
    );

    return (
        parts[0] === "wp-content" &&
        parts[1] === "themes"
    );
}

async function checkRequirements(): Promise<boolean> {
    const requirements = [
        {
            command: "php",
            name: "PHP",
        },
        {
            command: "composer",
            name: "Composer",
        },
        {
            command: "node",
            name: "Node.js",
        },
    ];

    for (const requirement of requirements) {
        if (
            !commandExists(
                requirement.command
            )
        ) {
            p.log.error(
                `${requirement.name} is not installed.`
            );

            return false;
        }

        p.log.success(
            `${requirement.name} found`
        );
    }

    if (!commandExists("tailpress")) {
        p.log.warning(
            "TailPress installer not found."
        );

        const install =
            await p.confirm({
                message:
                    "Install TailPress globally with Composer?",
                initialValue: true,
            });

        if (p.isCancel(install)) {
            p.cancel("Cancelled");
            return false;
        }

        if (!install) {
            p.log.info(
                "TailPress is required to create a project."
            );

            return false;
        }

        p.log.step(
            "Installing TailPress..."
        );

        await runCommand(
            "composer",
            [
                "global",
                "require",
                "tailpress/installer",
            ]
        );

        if (!commandExists("tailpress")) {
            p.log.error(
                "TailPress was installed, but the command is not available in PATH."
            );

            p.log.info(
                "Add the Composer global bin directory to PATH and try again."
            );

            return false;
        }
    }

    p.log.success(
        "TailPress found"
    );

    return true;
}

async function pathExists(
    target: string
): Promise<boolean> {
    try {
        await fs.access(target);

        return true;
    } catch {
        return false;
    }
}

async function resolveThemePath(
    projectPath: string,
    projectName: string
): Promise<string | null> {
    const possibleLocations = [
        // TailPress theme-only installation
        projectPath,

        // Full WordPress installation
        path.join(
            projectPath,
            "wp-content",
            "themes",
            projectName
        ),

        path.join(
            projectPath,
            "wp-content",
            "themes",
            projectName.toLowerCase()
        ),
    ];

    for (
        const location
        of possibleLocations
    ) {
        if (
            await looksLikeTailPressTheme(
                location
            )
        ) {
            return location;
        }
    }

    return findTailPressThemeRecursively(
        projectPath,
        5
    );
}

async function looksLikeWordPressTheme(
    directory: string
): Promise<boolean> {
    try {
        await Promise.all([
            fs.access(
                path.join(
                    directory,
                    "style.css"
                )
            ),

            fs.access(
                path.join(
                    directory,
                    "functions.php"
                )
            ),
        ]);

        return true;
    } catch {
        return false;
    }
}

async function looksLikeTailPressTheme(
    directory: string
): Promise<boolean> {
    if (
        !(await looksLikeWordPressTheme(
            directory
        ))
    ) {
        return false;
    }

    /*
     * Do not rely only on style.css + functions.php,
     * because default WordPress themes also contain them.
     *
     * TailPress projects normally contain package.json
     * and frontend/build-related files.
     */
    const indicators = [
        "package.json",
        "vite.config.js",
        "vite.config.ts",
        "tailwind.config.js",
        "tailwind.config.ts",
    ];

    for (const indicator of indicators) {
        if (
            await pathExists(
                path.join(
                    directory,
                    indicator
                )
            )
        ) {
            return true;
        }
    }

    return false;
}

async function findTailPressThemeRecursively(
    directory: string,
    depth: number
): Promise<string | null> {
    if (depth < 0) {
        return null;
    }

    if (
        await looksLikeTailPressTheme(
            directory
        )
    ) {
        return directory;
    }

    let entries: Dirent[];

    try {
        entries = await fs.readdir(
            directory,
            {
                withFileTypes: true,
            }
        );
    } catch {
        return null;
    }

    const ignoredDirectories = new Set([
        "node_modules",
        "vendor",
        ".git",
        ".idea",
        ".vscode",
    ]);

    for (const entry of entries) {
        if (!entry.isDirectory()) {
            continue;
        }

        if (
            ignoredDirectories.has(
                entry.name
            )
        ) {
            continue;
        }

        const result =
            await findTailPressThemeRecursively(
                path.join(
                    directory,
                    entry.name
                ),
                depth - 1
            );

        if (result) {
            return result;
        }
    }

    return null;
}
