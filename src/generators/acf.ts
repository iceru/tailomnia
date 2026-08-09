import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import type {
    AcfField,
    CptSchema,
} from "../types/schema.js";

function makeKey(prefix: string, value: string) {
    const hash = crypto
        .createHash("md5")
        .update(value)
        .digest("hex")
        .slice(0, 10);

    return `${prefix}_${hash}`;
}

function generateField(
    field: AcfField,
    postType: string
) {
    const base = {
        key: makeKey(
            "field",
            `${postType}_${field.name}`
        ),

        label: field.label,
        name: field.name,
        type: field.type,

        instructions: "",
        required: 0,
        conditional_logic: 0,

        wrapper: {
            width: "",
            class: "",
            id: "",
        },
    };

    switch (field.type) {
        case "text":
        case "email":
        case "url":
            return {
                ...base,
                default_value: "",
                placeholder: "",
            };

        case "textarea":
            return {
                ...base,
                default_value: "",
                rows: "",
                placeholder: "",
                new_lines: "",
            };

        case "number":
            return {
                ...base,
                default_value: "",
                min: "",
                max: "",
                step: "",
            };

        case "image":
            return {
                ...base,
                return_format: "array",
                preview_size: "medium",
                library: "all",
            };

        case "wysiwyg":
            return {
                ...base,
                default_value: "",
                tabs: "all",
                toolbar: "full",
                media_upload: 1,
            };

        case "select":
            return {
                ...base,

                choices: Object.fromEntries(
                    (field.choices ?? []).map((choice) => [
                        choice,
                        choice,
                    ])
                ),

                default_value: false,
                return_format: "value",
                multiple: 0,
                allow_null: 0,
                ui: 0,
            };

        case "true_false":
            return {
                ...base,
                message: "",
                default_value: 0,
                ui: 1,
            };

        case "date_picker":
            return {
                ...base,
                display_format: "d/m/Y",
                return_format: "Y-m-d",
                first_day: 1,
            };

        default:
            return base;
    }
}

export async function generateAcf(
    schema: CptSchema
) {
    if (schema.fields.length === 0) {
        return;
    }

    const fieldGroup = {
        key: `group_${schema.slug}`,

        title: `${schema.name} Details`,

        fields: schema.fields.map((field) =>
            generateField(field, schema.slug)
        ),

        location: [
            [
                {
                    param: "post_type",
                    operator: "==",
                    value: schema.slug,
                },
            ],
        ],

        menu_order: 0,
        position: "normal",
        style: "default",
        label_placement: "top",
        instruction_placement: "label",
        hide_on_screen: "",
        active: true,
        description: "",
        show_in_rest: 0,
    };

    const outputDir = path.resolve(
        process.cwd(),
        "acf-json"
    );

    await fs.mkdir(outputDir, {
        recursive: true,
    });

    await fs.writeFile(
        path.join(
            outputDir,
            `group_${schema.slug}.json`
        ),
        JSON.stringify(fieldGroup, null, 2),
        "utf8"
    );
}