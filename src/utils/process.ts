import { spawn } from "node:child_process";

function quoteWindowsArg(arg: string): string {
    if (!/[ \t\n\v"]/.test(arg)) {
        return arg;
    }

    return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/\\+$/g, "$&$&")}"`;
}

export function getSpawnCommand(
    command: string,
    args: string[] = []
): {
    command: string;
    args: string[];
} {
    if (process.platform !== "win32") {
        return {
            command,
            args,
        };
    }

    return {
        command: "cmd.exe",
        args: [
            "/d",
            "/s",
            "/c",
            [command, ...args]
                .map(quoteWindowsArg)
                .join(" "),
        ],
    };
}

export function runCommand(
    command: string,
    args: string[] = [],
    cwd?: string,
    env?: NodeJS.ProcessEnv
): Promise<void> {
    return new Promise((resolve, reject) => {
        const spawnCommand =
            getSpawnCommand(command, args);

        const child = spawn(
            spawnCommand.command,
            spawnCommand.args,
            {
                cwd,
                stdio: "inherit",
                env: env
                    ? { ...process.env, ...env }
                    : process.env,
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
