import fs from "node:fs/promises";
import path from "node:path";

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

import { spawnSync } from "node:child_process";

export function isWordPressInstalled(
    projectPath: string
): boolean {
    const result = spawnSync(
        "wp",
        [
            "core",
            "is-installed",
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