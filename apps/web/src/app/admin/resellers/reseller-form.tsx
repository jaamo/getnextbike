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
import { Textarea } from '@/components/ui/textarea';
import type { ResellerFormState } from './actions';

interface Props {
  action: (s: ResellerFormState, fd: FormData) => Promise<ResellerFormState>;
  statuses: readonly string[];
  initial?: Partial<{
    slug: string;
    name: string;
    logoUrl: string | null;
    description: string | null;
    primaryWebsiteUrl: string | null;
    status: string;
  }>;
  submitLabel: string;
}

export function ResellerForm({ action, statuses, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ResellerFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="slug" label="Slug" error={fe.slug}>
        <Input id="slug" name="slug" defaultValue={initial?.slug ?? ''} required />
      </Field>
      <Field id="name" label="Name" error={fe.name}>
        <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
      </Field>
      <Field id="status" label="Status" error={fe.status}>
        <Select name="status" defaultValue={initial?.status ?? 'active'}>
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="primaryWebsiteUrl" label="Primary website URL" error={fe.primaryWebsiteUrl}>
        <Input
          id="primaryWebsiteUrl"
          name="primaryWebsiteUrl"
          type="url"
          defaultValue={initial?.primaryWebsiteUrl ?? ''}
        />
      </Field>
      <Field id="logoUrl" label="Logo URL" error={fe.logoUrl}>
        <Input id="logoUrl" name="logoUrl" type="url" defaultValue={initial?.logoUrl ?? ''} />
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
