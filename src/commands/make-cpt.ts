import * as p from "@clack/prompts";

import type {
    AcfField,
    AcfFieldType,
    CptSchema,
} from "../types/schema.js";

import {
    kebabCase,
    slugify,
} from "../utils/string.js";

import { generateCpt } from "../generators/cpt.js";
import { generateAcf } from "../generators/acf.js";

const fieldTypes: {
    value: AcfFieldType;
    label: string;
}[] = [
        {
            value: "text",
            label: "Text",
        },
        {
            value: "textarea",
            label: "Textarea",
        },
        {
            value: "number",
            label: "Number",
        },
        {
            value: "email",
            label: "Email",
        },
        {
            value: "url",
            label: "URL",
        },
        {
            value: "image",
            label: "Image",
        },
        {
            value: "wysiwyg",
            label: "WYSIWYG",
        },
        {
            value: "select",
            label: "Select",
        },
        {
            value: "true_false",
            label: "True / False",
        },
        {
            value: "date_picker",
            label: "Date Picker",
        },
    ];

export async function makeCpt() {
    p.intro("tailomnia — Create Custom Post Type");

    const name = await p.text({
        message: "CPT name?",
        placeholder: "Tenant",
        validate(value) {
            if (value && !value.trim()) {
                return "CPT name is required";
            }
        },
    });

    if (p.isCancel(name)) {
        p.cancel("Cancelled");
        return;
    }

    const plural = await p.text({
        message: "Plural name?",
        initialValue: `${name}s`,
    });

    if (p.isCancel(plural)) {
        p.cancel("Cancelled");
        return;
    }

    const slug = await p.text({
        message: "Slug?",
        initialValue: kebabCase(String(name)),
    });

    if (p.isCancel(slug)) {
        p.cancel("Cancelled");
        return;
    }

    const hasArchive = await p.confirm({
        message: "Enable archive?",
        initialValue: true,
    });

    if (p.isCancel(hasArchive)) {
        p.cancel("Cancelled");
        return;
    }

    const fields: AcfField[] = [];

    let addAnotherField = await p.confirm({
        message: "Add custom fields?",
        initialValue: true,
    });

    while (addAnotherField === true) {
        const label = await p.text({
            message: "Field label?",
            placeholder: "Logo",
            validate(value) {
                if (value && !value.trim()) {
                    return "Field label is required";
                }
            },
        });

        if (p.isCancel(label)) {
            break;
        }

        const fieldName = await p.text({
            message: "Field name?",
            initialValue: slugify(String(label)),
        });

        if (p.isCancel(fieldName)) {
            break;
        }

        const type = await p.select({
            message: "Field type?",
            options: fieldTypes,
        });

        if (p.isCancel(type)) {
            break;
        }

        const field: AcfField = {
            label: String(label),
            name: String(fieldName),
            type: type as AcfFieldType,
        };

        if (type === "select") {
            const choices = await p.text({
                message: "Choices? Separate with commas",
                placeholder: "LG,GF,1F,2F",
            });

            if (!p.isCancel(choices) && choices) {
                field.choices = String(choices)
                    .split(",")
                    .map((choice) => choice.trim())
                    .filter(Boolean);
            }
        }

        fields.push(field);

        addAnotherField = await p.confirm({
            message: "Add another field?",
            initialValue: true,
        });
    }

    const schema: CptSchema = {
        name: String(name),
        plural: String(plural),
        slug: String(slug),
        hasArchive: Boolean(hasArchive),
        fields,
    };

    const spinner = p.spinner();

    spinner.start("Generating files");

    await generateCpt(schema);
    await generateAcf(schema);

    spinner.stop("Files generated");

    p.note(
        [
            `CPT: ${schema.name}`,
            `Slug: ${schema.slug}`,
            `Fields: ${schema.fields.length}`,
        ].join("\n"),
        "Generated"
    );

    p.outro("Done");
}