import { z } from "zod";

export interface ContentCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number | null;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  categoryId: string | null;
  isPublished: boolean | null;
  publishedAt: string | null;
  category?: ContentCategory;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  categoryId: string | null;
  displayOrder: number | null;
  isPublished: boolean | null;
  category?: ContentCategory;
}

export const articleFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  summary: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  categoryId: z.string().optional(),
  isPublished: z.boolean().default(false),
});

export const faqFormSchema = z.object({
  question: z.string().min(1, "Question is required"),
  answer: z.string().min(1, "Answer is required"),
  categoryId: z.string().optional(),
  displayOrder: z.number().default(0),
  isPublished: z.boolean().default(false),
});

export const categoryFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  displayOrder: z.number().default(0),
});

export type ArticleFormData = z.infer<typeof articleFormSchema>;
export type FaqFormData = z.infer<typeof faqFormSchema>;
export type CategoryFormData = z.infer<typeof categoryFormSchema>;
