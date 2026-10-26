import { z } from "zod";
import { HexColorSchema } from "@moneymind/shared";

/**
 * Web-only form contracts. They stay close to the shared API inputs but accept
 * the strings native HTML controls actually produce (decimal amount, empty
 * optional fields), then the submit handler converts to minor units.
 */

export const AmountInputSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .max(18, "Use a smaller amount")
  .regex(/^\d{1,12}(\.\d{1,3})?$/, "Use a number like 1250.00")
  .refine((value) => /[1-9]/.test(value), "Amount must be greater than zero");

const OptionalDateSchema = z.union([z.literal(""), z.iso.date()]);

export const TransactionFormSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: AmountInputSchema,
  description: z
    .string()
    .trim()
    .min(2, "Enter a short description")
    .max(160, "Use 160 characters or fewer"),
  categoryId: z.string().trim(),
  date: z.iso.date("Choose a date"),
  merchant: z.string().trim().max(120, "Use 120 characters or fewer"),
  notes: z.string().trim().max(1000, "Use 1000 characters or fewer"),
});

export type TransactionFormValues = z.infer<typeof TransactionFormSchema>;

export const CategoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters")
    .max(60, "Use 60 characters or fewer"),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: HexColorSchema,
  icon: z.string().trim().max(40),
});

export type CategoryFormValues = z.infer<typeof CategoryFormSchema>;

export const BudgetFormSchema = z.object({
  categoryId: z.string().trim().min(1, "Pick a category"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month"),
  amount: AmountInputSchema,
});

export type BudgetFormValues = z.infer<typeof BudgetFormSchema>;

export const GoalFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter at least 2 characters")
    .max(80, "Use 80 characters or fewer"),
  targetAmount: AmountInputSchema,
  targetDate: OptionalDateSchema,
  notes: z.string().trim().max(500, "Use 500 characters or fewer"),
});

export type GoalFormValues = z.infer<typeof GoalFormSchema>;

export const ContributionFormSchema = z.object({
  amount: AmountInputSchema,
  date: z.iso.date("Choose a date"),
  note: z.string().trim().max(300, "Use 300 characters or fewer"),
});

export type ContributionFormValues = z.infer<typeof ContributionFormSchema>;
