import { spawnSync } from "node:child_process";

export function commandExists(command: string): boolean {
    const lookupCommand =
        process.platform === "win32"
            ? "where"
            : "which";

    const result = spawnSync(
        lookupCommand,
        [command],
        {
            stdio: "ignore",
            shell: true,
        }
    );

    return result.status === 0;
}