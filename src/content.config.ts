import { z, defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const writeupsCollection = defineCollection({
    loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/writeups" }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        tags: z.array(z.string()),
        links: z
            .array(
                z.object({
                    label: z.string(),
                    url: z.string().url(),
                }),
            )
            .optional(),
    }),
});

export const collections = {
    writeups: writeupsCollection,
};
