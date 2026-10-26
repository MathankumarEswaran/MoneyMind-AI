import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import type { Category, CategoryKind } from "@moneymind/shared";
import { FormField } from "@/components/auth/form-field";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CategoryIcon } from "@/components/finance/category-icon";
import { CATEGORY_ICON_OPTIONS } from "@/lib/category-icons";
import { api } from "@/lib/api";
import { CategoryFormSchema, type CategoryFormValues } from "@/lib/finance-schemas";
import { describeFinanceError } from "@/lib/finance";
import { fieldInputClass } from "@/lib/form-styles";

const FORM_ID = "category-form";

const PRESET_COLORS = [
  "#10b981",
  "#14b8a6",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#64748b",
] as const;

export function CategoryDialog({
  open,
  onClose,
  category,
  defaultKind = "EXPENSE",
}: {
  open: boolean;
  onClose: () => void;
  category?: Category | null;
  defaultKind?: CategoryKind;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(CategoryFormSchema),
    defaultValues: { name: "", kind: defaultKind, color: "#6366f1", icon: "" },
  });

  const color = watch("color");
  const icon = watch("icon");
  const kind = watch("kind");

  useEffect(() => {
    if (!open) return;

    reset({
      name: category?.name ?? "",
      kind: category?.kind ?? defaultKind,
      color: category?.color ?? "#6366f1",
      icon: category?.icon ?? "",
    });
  }, [open, category, defaultKind, reset]);

  const mutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      const iconValue = values.icon || undefined;

      if (category) {
        return api.updateCategory(category.id, {
          name: values.name,
          color: values.color,
          ...(iconValue ? { icon: iconValue } : {}),
        });
      }

      return api.createCategory({
        name: values.name,
        kind: values.kind,
        color: values.color,
        ...(iconValue ? { icon: iconValue } : {}),
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
      title={category ? "Edit category" : "New category"}
      description={
        category
          ? "Rename, recolour or change the icon. The category type stays fixed."
          : "Custom categories keep reporting meaningful for your household."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : category ? "Save changes" : "Create category"}
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
            <span>{describeFinanceError(mutation.error, "Could not save this category.")}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-3">
          <CategoryIcon icon={icon} color={color} className="size-10 rounded-xl" />
          <div>
            <p className="text-xs font-medium">Preview</p>
            <p className="text-[11px] text-muted-foreground">
              Shown in transactions, budgets and charts.
            </p>
          </div>
        </div>

        <FormField id="category-name" label="Name" error={errors.name?.message}>
          <Input
            id="category-name"
            placeholder="Pets"
            aria-invalid={Boolean(errors.name)}
            className={fieldInputClass(errors.name?.message)}
            {...register("name")}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="category-kind" label="Type" error={errors.kind?.message}>
            <Select
              id="category-kind"
              disabled={Boolean(category)}
              aria-invalid={Boolean(errors.kind)}
              className={fieldInputClass(errors.kind?.message)}
              {...register("kind")}
            >
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </Select>
          </FormField>

          <FormField id="category-icon" label="Icon" error={errors.icon?.message}>
            <Select id="category-icon" {...register("icon")}>
              <option value="">No icon</option>
              {CATEGORY_ICON_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option.replace(/-/g, " ")}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          id="category-color"
          label="Colour"
          error={errors.color?.message}
          hint={
            category ? undefined : `Used for ${kind === "INCOME" ? "income" : "expense"} charts.`
          }
        >
          <div className="flex items-center gap-2">
            <Input
              id="category-color"
              type="color"
              aria-label="Category colour"
              className="h-10 w-14 shrink-0 cursor-pointer p-1"
              {...register("color")}
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Use ${preset}`}
                  aria-pressed={color.toLowerCase() === preset}
                  className="size-6 rounded-full border border-white/40 ring-offset-2 ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                  style={{
                    backgroundColor: preset,
                    boxShadow: color.toLowerCase() === preset ? `0 0 0 2px ${preset}55` : undefined,
                  }}
                  onClick={() => setValue("color", preset, { shouldDirty: true })}
                />
              ))}
            </div>
          </div>
        </FormField>
      </form>
    </Modal>
  );
}
