'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ModelYearFormState } from './actions';

interface Props {
  action: (s: ModelYearFormState, fd: FormData) => Promise<ModelYearFormState>;
  models: ReadonlyArray<{ id: string; label: string }>;
  initial?: Partial<{
    modelId: string;
    year: number;
    msrpAmount: string | null;
    msrpCurrency: string | null;
    heroImageUrl: string | null;
    specSheetUrl: string | null;
  }>;
  submitLabel: string;
}

export function ModelYearForm({ action, models, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ModelYearFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="modelId" label="Model" error={fe.modelId}>
        <Select name="modelId" defaultValue={initial?.modelId ?? models[0]?.id}>
          <SelectTrigger id="modelId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="year" label="Year" error={fe.year}>
        <Input
          id="year"
          name="year"
          type="number"
          min={1980}
          max={2100}
          defaultValue={initial?.year ?? new Date().getFullYear()}
          required
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="msrpAmount" label="MSRP" error={fe.msrpAmount}>
          <Input
            id="msrpAmount"
            name="msrpAmount"
            defaultValue={initial?.msrpAmount ?? ''}
            placeholder="4299.00"
          />
        </Field>
        <Field id="msrpCurrency" label="Currency" error={fe.msrpCurrency}>
          <Input
            id="msrpCurrency"
            name="msrpCurrency"
            maxLength={3}
            defaultValue={initial?.msrpCurrency ?? ''}
            placeholder="EUR"
          />
        </Field>
      </div>
      <Field id="heroImageUrl" label="Hero image URL" error={fe.heroImageUrl}>
        <Input
          id="heroImageUrl"
          name="heroImageUrl"
          type="url"
          defaultValue={initial?.heroImageUrl ?? ''}
        />
      </Field>
      <Field id="specSheetUrl" label="Spec sheet URL" error={fe.specSheetUrl}>
        <Input
          id="specSheetUrl"
          name="specSheetUrl"
          type="url"
          defaultValue={initial?.specSheetUrl ?? ''}
        />
      </Field>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
