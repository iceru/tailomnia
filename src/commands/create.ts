import path from "node:path";
import fs from "node:fs/promises";
import * as p from "@clack/prompts";

import { commandExists } from "../utils/command-exists.js";
import { runCommand } from "../utils/process.js";
import { setupTailomnia } from "../setup/tailomnia.js";
import {
    isWordPressProject,
    isWordPressInstalled,
} from "../utils/wordpress.js";
import { setupWordPress } from "../setup/wordpress.js";

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

    try {
        p.log.step(
            "Starting TailPress installer..."
        );

        await runCommand(
            "tailpress",
            [
                "new",
                projectName,
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

    let entries: fs.Dirent[];

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