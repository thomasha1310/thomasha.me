import { z, defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const writeupsCollection = defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/writeups" }),
    schema: z.object({
        title: z.string(),
        date: z.date(),
        description: z.string(),
    }),
});

export const collections = {
    writeups: writeupsCollection,
};
