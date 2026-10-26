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
import { GoalFormSchema, type GoalFormValues } from "@/lib/finance-schemas";
import { describeFinanceError, minorToAmountInput } from "@/lib/finance";
import { fieldInputClass } from "@/lib/form-styles";

const FORM_ID = "goal-form";

export function GoalDialog({
  open,
  onClose,
  goal,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  goal?: Goal | null;
  currency: string;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(GoalFormSchema),
    defaultValues: { name: "", targetAmount: "", targetDate: "", notes: "" },
  });

  useEffect(() => {
    if (!open) return;

    reset({
      name: goal?.name ?? "",
      targetAmount: goal ? minorToAmountInput(goal.targetAmountMinor, currency) : "",
      targetDate: goal?.targetDate ?? "",
      notes: goal?.notes ?? "",
    });
  }, [open, goal, currency, reset]);

  const mutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      const targetAmountMinor = parseMoneyToMinor(values.targetAmount, currency).toString();

      if (goal) {
        return api.updateGoal(goal.id, {
          name: values.name,
          targetAmountMinor,
          targetDate: values.targetDate || null,
          notes: values.notes || null,
        });
      }

      return api.createGoal({
        name: values.name,
        targetAmountMinor,
        targetDate: values.targetDate || null,
        notes: values.notes || null,
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
      title={goal ? "Edit savings goal" : "New savings goal"}
      description="Progress comes from contributions, so it always reflects what you actually set aside."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : goal ? "Save changes" : "Create goal"}
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
            <span>{describeFinanceError(mutation.error, "Could not save this goal.")}</span>
          </div>
        ) : null}

        <FormField id="goal-name" label="Goal name" error={errors.name?.message}>
          <Input
            id="goal-name"
            placeholder="Emergency fund"
            aria-invalid={Boolean(errors.name)}
            className={fieldInputClass(errors.name?.message)}
            {...register("name")}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="goal-target"
            label={`Target amount (${currency})`}
            error={errors.targetAmount?.message}
          >
            <Input
              id="goal-target"
              inputMode="decimal"
              placeholder="0.00"
              aria-invalid={Boolean(errors.targetAmount)}
              className={fieldInputClass(errors.targetAmount?.message)}
              {...register("targetAmount")}
            />
          </FormField>

          <FormField
            id="goal-target-date"
            label="Target date (optional)"
            error={errors.targetDate?.message}
          >
            <Input
              id="goal-target-date"
              type="date"
              aria-invalid={Boolean(errors.targetDate)}
              className={fieldInputClass(errors.targetDate?.message)}
              {...register("targetDate")}
            />
          </FormField>
        </div>

        <FormField id="goal-notes" label="Notes (optional)" error={errors.notes?.message}>
          <Textarea
            id="goal-notes"
            placeholder="What is this goal for?"
            aria-invalid={Boolean(errors.notes)}
            className={fieldInputClass(errors.notes?.message)}
            {...register("notes")}
          />
        </FormField>
      </form>
    </Modal>
  );
}
