import fs from "node:fs/promises";
import path from "node:path";

export async function setupTailomnia(
    themePath: string
) {
    const directories = [
        "acf-json",
        "app/PostTypes",
        "app/Taxonomies",
        "app/Fields",
        "template-parts/components",
    ];

    for (const directory of directories) {
        await fs.mkdir(
            path.join(themePath, directory),
            {
                recursive: true,
            }
        );
    }

    const config = {
        schemaVersion: 1,

        project: {
            name: path.basename(themePath),
        },

        paths: {
            postTypes: "app/PostTypes",
            taxonomies: "app/Taxonomies",
            fields: "app/Fields",
            acfJson: "acf-json",
            components: "template-parts/components",
        },
    };

    await fs.writeFile(
        path.join(themePath, "tailomnia.json"),
        JSON.stringify(config, null, 2),
        "utf8"
    );
}