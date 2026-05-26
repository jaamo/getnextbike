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
import type { ComponentFormState } from './actions';

interface Props {
  action: (state: ComponentFormState, formData: FormData) => Promise<ComponentFormState>;
  types: readonly string[];
  initial?: Partial<{
    type: string;
    manufacturer: string | null;
    name: string;
    tier: string | null;
    specJson: Record<string, unknown> | null;
  }>;
  submitLabel: string;
}

export function ComponentForm({ action, types, initial, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState<ComponentFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const specJsonDefault = initial?.specJson ? JSON.stringify(initial.specJson, null, 2) : '';

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="type" label="Type" error={fe.type}>
        <Select name="type" defaultValue={initial?.type ?? types[0]}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="manufacturer" label="Manufacturer" error={fe.manufacturer}>
        <Input
          id="manufacturer"
          name="manufacturer"
          defaultValue={initial?.manufacturer ?? ''}
          placeholder="Shimano"
        />
      </Field>
      <Field id="name" label="Name" error={fe.name}>
        <Input
          id="name"
          name="name"
          defaultValue={initial?.name ?? ''}
          placeholder="Ultegra Di2 R8170"
          required
        />
      </Field>
      <Field id="tier" label="Tier" error={fe.tier}>
        <Input id="tier" name="tier" defaultValue={initial?.tier ?? ''} placeholder="Ultegra" />
      </Field>
      <Field id="specJson" label="Spec JSON" error={fe.specJson}>
        <Textarea
          id="specJson"
          name="specJson"
          defaultValue={specJsonDefault}
          rows={6}
          placeholder='{"speeds": 12, "type": "electronic"}'
          className="font-mono text-xs"
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
