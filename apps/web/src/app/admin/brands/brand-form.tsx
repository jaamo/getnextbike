'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BrandFormState } from './actions';

interface Props {
  action: (state: BrandFormState, formData: FormData) => Promise<BrandFormState>;
  initial?: Partial<{
    slug: string;
    name: string;
    countryCode: string | null;
    websiteUrl: string | null;
    description: string | null;
  }>;
  submitLabel: string;
}

export function BrandForm({ action, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<BrandFormState, FormData>(action, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="slug" label="Slug" error={fe.slug}>
        <Input id="slug" name="slug" defaultValue={initial?.slug ?? ''} required />
      </Field>
      <Field id="name" label="Name" error={fe.name}>
        <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
      </Field>
      <Field id="countryCode" label="Country code (ISO 3166-1 alpha-2)" error={fe.countryCode}>
        <Input
          id="countryCode"
          name="countryCode"
          maxLength={2}
          defaultValue={initial?.countryCode ?? ''}
          placeholder="US"
        />
      </Field>
      <Field id="websiteUrl" label="Website URL" error={fe.websiteUrl}>
        <Input
          id="websiteUrl"
          name="websiteUrl"
          type="url"
          defaultValue={initial?.websiteUrl ?? ''}
          placeholder="https://…"
        />
      </Field>
      <Field id="description" label="Description" error={fe.description}>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ''}
          rows={4}
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
