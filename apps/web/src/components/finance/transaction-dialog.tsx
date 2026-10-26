import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import {
  dateOnlyToUtcNoon,
  parseMoneyToMinor,
  type Category,
  type CategoryKind,
  type Transaction,
} from "@moneymind/shared";
import { FormField } from "@/components/auth/form-field";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { TransactionFormSchema, type TransactionFormValues } from "@/lib/finance-schemas";
import {
  dateInputValue,
  describeFinanceError,
  minorToAmountInput,
  todayInTimeZone,
} from "@/lib/finance";
import { fieldInputClass } from "@/lib/form-styles";

const FORM_ID = "transaction-form";

export function TransactionDialog({
  open,
  onClose,
  transaction,
  defaultType = "EXPENSE",
  categories,
  currency,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  transaction?: Transaction | null;
  defaultType?: CategoryKind;
  categories: Category[];
  currency: string;
  timezone: string;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(TransactionFormSchema),
    defaultValues: {
      type: defaultType,
      amount: "",
      description: "",
      categoryId: "",
      date: todayInTimeZone(timezone),
      merchant: "",
      notes: "",
    },
  });

  const type = watch("type");
  const categoryId = watch("categoryId");

  useEffect(() => {
    if (!open) return;

    reset({
      type: transaction?.type ?? defaultType,
      amount: transaction ? minorToAmountInput(transaction.amountMinor, currency) : "",
      description: transaction?.description ?? "",
      categoryId: transaction?.category?.id ?? "",
      date: transaction
        ? dateInputValue(transaction.occurredAt, timezone)
        : todayInTimeZone(timezone),
      merchant: transaction?.merchant ?? "",
      notes: transaction?.notes ?? "",
    });
  }, [open, transaction, defaultType, currency, timezone, reset]);

  useEffect(() => {
    if (!categoryId) return;
    const selected = categories.find((category) => category.id === categoryId);
    if (selected && selected.kind !== type) setValue("categoryId", "");
  }, [type, categoryId, categories, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: TransactionFormValues) => {
      const payload = {
        type: values.type,
        amountMinor: parseMoneyToMinor(values.amount, currency).toString(),
        description: values.description,
        categoryId: values.categoryId || null,
        merchant: values.merchant || null,
        notes: values.notes || null,
        occurredAt: dateOnlyToUtcNoon(values.date, timezone).toISOString(),
      };

      return transaction
        ? api.updateTransaction(transaction.id, payload)
        : api.createTransaction(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    },
  });

  const visibleCategories = categories.filter((category) => category.kind === type);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? "Edit transaction" : "New transaction"}
      description="Amounts are recorded in your workspace currency."
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : transaction ? "Save changes" : "Add transaction"}
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
            <span>{describeFinanceError(mutation.error, "Could not save this transaction.")}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="transaction-type" label="Type">
            <Select id="transaction-type" {...register("type")}>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
          </FormField>

          <FormField
            id="transaction-amount"
            label={`Amount (${currency})`}
            error={errors.amount?.message}
          >
            <Input
              id="transaction-amount"
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={Boolean(errors.amount)}
              className={fieldInputClass(errors.amount?.message)}
              {...register("amount")}
            />
          </FormField>

          <FormField
            id="transaction-description"
            label="Description"
            error={errors.description?.message}
          >
            <Input
              id="transaction-description"
              placeholder="Weekly groceries"
              aria-invalid={Boolean(errors.description)}
              className={fieldInputClass(errors.description?.message)}
              {...register("description")}
            />
          </FormField>

          <FormField id="transaction-date" label="Date" error={errors.date?.message}>
            <Input
              id="transaction-date"
              type="date"
              aria-invalid={Boolean(errors.date)}
              className={fieldInputClass(errors.date?.message)}
              {...register("date")}
            />
          </FormField>

          <FormField id="transaction-category" label="Category" error={errors.categoryId?.message}>
            <Select id="transaction-category" {...register("categoryId")}>
              <option value="">Uncategorized</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            id="transaction-merchant"
            label="Merchant (optional)"
            error={errors.merchant?.message}
          >
            <Input
              id="transaction-merchant"
              placeholder="Whole Foods"
              aria-invalid={Boolean(errors.merchant)}
              className={fieldInputClass(errors.merchant?.message)}
              {...register("merchant")}
            />
          </FormField>
        </div>

        <FormField id="transaction-notes" label="Notes (optional)" error={errors.notes?.message}>
          <Textarea
            id="transaction-notes"
            placeholder="Anything worth remembering about this transaction"
            aria-invalid={Boolean(errors.notes)}
            className={fieldInputClass(errors.notes?.message)}
            {...register("notes")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
