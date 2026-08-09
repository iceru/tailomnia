import fs from "node:fs/promises";
import path from "node:path";

import type { CptSchema } from "../types/schema.js";
import { pascalCase } from "../utils/string.js";

export async function generateCpt(schema: CptSchema) {
    const fileName = `${pascalCase(schema.name)}.php`;

    const php = `<?php

add_action('init', function () {
    register_post_type('${schema.slug}', [
        'labels' => [
            'name' => __('${schema.plural}'),
            'singular_name' => __('${schema.name}'),
        ],

        'public' => true,
        'has_archive' => ${schema.hasArchive ? "true" : "false"},
        'show_in_rest' => true,

        'supports' => [
            'title',
            'editor',
            'thumbnail',
        ],
    ]);
});
`;

    const outputDir = path.resolve(
        process.cwd(),
        "app",
        "PostTypes"
    );

    await fs.mkdir(outputDir, {
        recursive: true,
    });

    await fs.writeFile(
        path.join(outputDir, fileName),
        php,
        "utf8"
    );
}