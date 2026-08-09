export type AcfFieldType =
    | "text"
    | "textarea"
    | "number"
    | "email"
    | "url"
    | "image"
    | "wysiwyg"
    | "select"
    | "true_false"
    | "date_picker";

export interface AcfField {
    label: string;
    name: string;
    type: AcfFieldType;
    choices?: string[];
}

export interface CptSchema {
    name: string;
    plural: string;
    slug: string;
    hasArchive: boolean;
    fields: AcfField[];
}