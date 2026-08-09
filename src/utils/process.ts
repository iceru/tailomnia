import { spawn } from "node:child_process";

export function runCommand(
    command: string,
    args: string[] = [],
    cwd?: string
): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(
            command,
            args,
            {
                cwd,
                stdio: "inherit",
                shell: process.platform === "win32",
            }
        );

        child.on("error", reject);

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(
                    `${command} exited with code ${code}`
                )
            );
        });
    });
}