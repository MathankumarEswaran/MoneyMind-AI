import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { parseMoneyToMinor, type Goal } from "@moneymind/shared";
import { FormField } from "@/components/auth/form-field";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { ContributionFormSchema, type ContributionFormValues } from "@/lib/finance-schemas";
import { describeFinanceError, todayInTimeZone } from "@/lib/finance";
import { fieldInputClass } from "@/lib/form-styles";

const FORM_ID = "contribution-form";

export function ContributionDialog({
  open,
  onClose,
  goal,
  currency,
  timezone,
}: {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  currency: string;
  timezone: string;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContributionFormValues>({
    resolver: zodResolver(ContributionFormSchema),
    defaultValues: { amount: "", date: todayInTimeZone(timezone), note: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({ amount: "", date: todayInTimeZone(timezone), note: "" });
  }, [open, timezone, reset]);

  const mutation = useMutation({
    mutationFn: async (values: ContributionFormValues) => {
      if (!goal) throw new Error("Pick a goal first.");

      return api.addGoalContribution(goal.id, {
        amountMinor: parseMoneyToMinor(values.amount, currency).toString(),
        occurredAt: values.date,
        note: values.note || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance"] });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add contribution"
      description={
        goal
          ? `Record money set aside for “${goal.name}”. Progress updates immediately.`
          : "Pick a goal before adding money."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting || !goal}>
            {isSubmitting ? "Saving…" : "Add contribution"}
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
            <span>{describeFinanceError(mutation.error, "Could not add this contribution.")}</span>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="contribution-amount"
            label={`Amount (${currency})`}
            error={errors.amount?.message}
          >
            <Input
              id="contribution-amount"
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={Boolean(errors.amount)}
              className={fieldInputClass(errors.amount?.message)}
              {...register("amount")}
            />
          </FormField>

          <FormField id="contribution-date" label="Date" error={errors.date?.message}>
            <Input
              id="contribution-date"
              type="date"
              aria-invalid={Boolean(errors.date)}
              className={fieldInputClass(errors.date?.message)}
              {...register("date")}
            />
          </FormField>
        </div>

        <FormField id="contribution-note" label="Note (optional)" error={errors.note?.message}>
          <Textarea
            id="contribution-note"
            placeholder="March savings transfer"
            aria-invalid={Boolean(errors.note)}
            className={fieldInputClass(errors.note?.message)}
            {...register("note")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
