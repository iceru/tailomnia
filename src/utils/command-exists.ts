import { spawnSync } from "node:child_process";
import { getSpawnCommand } from "./process.js";

export function commandExists(command: string): boolean {
    const lookupCommand =
        process.platform === "win32"
            ? "where.exe"
            : "which";
    const spawnCommand = getSpawnCommand(
        lookupCommand,
        [command]
    );

    const result = spawnSync(
        spawnCommand.command,
        spawnCommand.args,
        {
            stdio: "ignore",
        }
    );

    return result.status === 0;
}
