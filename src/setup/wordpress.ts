import * as p from "@clack/prompts";

import { commandExists } from "../utils/command-exists.js";
import { runCommand } from "../utils/process.js";
import { spawnSync } from "node:child_process";

interface SetupWordPressOptions {
    projectPath: string;
    themeSlug: string;
    installAcf: boolean;
}

export async function setupWordPress({
    projectPath,
    themeSlug,
    installAcf: shouldInstallAcf,
}: SetupWordPressOptions) {
    if (!commandExists("wp")) {
        p.log.warning(
            "WP-CLI is not installed."
        );

        return;
    }

    if (shouldInstallAcf) {
        await installAcf(projectPath);
    }

    await activateTheme(
        projectPath,
        themeSlug
    );
}

async function installAcf(
    projectPath: string
) {
    if (
        isPluginInstalled(
            projectPath,
            "advanced-custom-fields"
        )
    ) {
        p.log.success(
            "ACF already installed"
        );

        await runCommand(
            "wp",
            [
                "plugin",
                "activate",
                "advanced-custom-fields",
            ],
            projectPath
        );

        return;
    }

    p.log.step(
        "Installing ACF..."
    );

    await runCommand(
        "wp",
        [
            "plugin",
            "install",
            "advanced-custom-fields",
            "--activate",
        ],
        projectPath
    );

    p.log.success(
        "ACF installed and activated"
    );
}

async function activateTheme(
    projectPath: string,
    themeSlug: string
) {
    p.log.step(
        `Activating ${themeSlug} theme...`
    );

    await runCommand(
        "wp",
        [
            "theme",
            "activate",
            themeSlug,
        ],
        projectPath
    );

    p.log.success(
        "Theme activated"
    );
}

function isPluginInstalled(
    projectPath: string,
    plugin: string
): boolean {
    const result = spawnSync(
        "wp",
        [
            "plugin",
            "is-installed",
            plugin,
        ],
        {
            cwd: projectPath,
            stdio: "ignore",
            shell:
                process.platform === "win32",
        }
    );

    return result.status === 0;
}