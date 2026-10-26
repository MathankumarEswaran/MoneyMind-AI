import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { parseMoneyToMinor, type Budget, type Category } from "@moneymind/shared";
import { FormField } from "@/components/auth/form-field";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { BudgetFormSchema, type BudgetFormValues } from "@/lib/finance-schemas";
import { describeFinanceError, formatMonthLabel, minorToAmountInput } from "@/lib/finance";
import { fieldInputClass } from "@/lib/form-styles";

const FORM_ID = "budget-form";

export function BudgetDialog({
  open,
  onClose,
  budget,
  categories,
  currency,
  month,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  budget?: Budget | null;
  categories: Category[];
  currency: string;
  month: string;
  locale: string;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(BudgetFormSchema),
    defaultValues: { categoryId: "", month, amount: "" },
  });

  useEffect(() => {
    if (!open) return;

    reset({
      categoryId: budget?.category.id ?? "",
      month: budget?.month ?? month,
      amount: budget ? minorToAmountInput(budget.amountMinor, currency) : "",
    });
  }, [open, budget, month, currency, reset]);

  const mutation = useMutation({
    mutationFn: async (values: BudgetFormValues) => {
      const amountMinor = parseMoneyToMinor(values.amount, currency).toString();

      if (budget) {
        return api.updateBudget(budget.id, { amountMinor });
      }

      return api.createBudget({
        categoryId: values.categoryId,
        month: values.month,
        amountMinor,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    },
  });

  const expenseCategories = categories.filter((category) => category.kind === "EXPENSE");
  const editing = Boolean(budget);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit budget" : "New budget"}
      description={
        editing
          ? "Update the monthly limit. Spending is recalculated from every expense in that category."
          : `Set a spending limit for ${formatMonthLabel(month, locale)}.`
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : editing ? "Save changes" : "Create budget"}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="space-y-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
      >
        {mutation.isError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{describeFinanceError(mutation.error, "Could not save this budget.")}</span>
          </div>
        ) : null}

        <FormField id="budget-category" label="Expense category" error={errors.categoryId?.message}>
          <Select
            id="budget-category"
            disabled={editing}
            aria-invalid={Boolean(errors.categoryId)}
            className={fieldInputClass(errors.categoryId?.message)}
            {...register("categoryId")}
          >
            <option value="">Pick a category</option>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="budget-month" label="Month" error={errors.month?.message}>
            <Input
              id="budget-month"
              type="month"
              disabled={editing}
              aria-invalid={Boolean(errors.month)}
              className={fieldInputClass(errors.month?.message)}
              {...register("month")}
            />
          </FormField>

          <FormField
            id="budget-amount"
            label={`Limit (${currency})`}
            error={errors.amount?.message}
          >
            <Input
              id="budget-amount"
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={Boolean(errors.amount)}
              className={fieldInputClass(errors.amount?.message)}
              {...register("amount")}
            />
          </FormField>
        </div>

        <p className="text-[11px] leading-5 text-muted-foreground">
          Budgets track expenses only. Every transaction in the category for that month counts
          toward the limit, including ones added later.
        </p>
      </form>
    </Modal>
  );
}
