import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { getSpawnCommand } from "./process.js";

export async function isWordPressProject(
    projectPath: string
): Promise<boolean> {
    const requiredFiles = [
        "wp-config.php",
        "wp-load.php",
    ];

    try {
        await Promise.all(
            requiredFiles.map((file) =>
                fs.access(
                    path.join(projectPath, file)
                )
            )
        );

        return true;
    } catch {
        return false;
    }
}

export function isWordPressInstalled(
    projectPath: string
): boolean {
    const spawnCommand = getSpawnCommand(
        "wp",
        [
            "core",
            "is-installed",
        ]
    );

    const result = spawnSync(
        spawnCommand.command,
        spawnCommand.args,
        {
            cwd: projectPath,
            stdio: "ignore",
        }
    );

    return result.status === 0;
}
