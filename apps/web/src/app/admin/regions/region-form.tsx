'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RegionFormState } from './actions';

interface Props {
  action: (state: RegionFormState, formData: FormData) => Promise<RegionFormState>;
  initial?: { code: string; name: string; defaultCurrency: string; countries: string[] };
  submitLabel: string;
}

export function RegionForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<RegionFormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="code" label="Code (e.g. EU, US, FI)" error={fe.code}>
        <Input id="code" name="code" defaultValue={initial?.code ?? ''} required />
      </Field>
      <Field id="name" label="Name" error={fe.name}>
        <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
      </Field>
      <Field id="defaultCurrency" label="Default currency (ISO 4217)" error={fe.defaultCurrency}>
        <Input
          id="defaultCurrency"
          name="defaultCurrency"
          maxLength={3}
          defaultValue={initial?.defaultCurrency ?? ''}
          required
        />
      </Field>
      <Field
        id="countries"
        label="Countries (comma-separated ISO codes, e.g. FI,SE,DK)"
        error={fe.countries}
      >
        <Input id="countries" name="countries" defaultValue={initial?.countries?.join(',') ?? ''} />
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
