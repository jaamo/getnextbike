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
import type { InventoryUpdateState } from './actions';
import { NONE_VARIANT_VALUE } from './constants';

interface Props {
  action: (s: InventoryUpdateState, fd: FormData) => Promise<InventoryUpdateState>;
  statuses: readonly string[];
  variants: ReadonlyArray<{ id: string; label: string }>;
  initial: {
    variantId: string | null;
    status: string;
    resellerSku: string | null;
    titleAtSource: string | null;
  };
}

export function EditInventoryForm({ action, statuses, variants, initial }: Props) {
  const [state, formAction, pending] = useActionState<InventoryUpdateState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="variantId" label="Matched variant" error={fe.variantId}>
        <Select name="variantId" defaultValue={initial.variantId ?? NONE_VARIANT_VALUE}>
          <SelectTrigger id="variantId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VARIANT_VALUE}>— unmatched —</SelectItem>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="status" label="Status" error={fe.status}>
        <Select name="status" defaultValue={initial.status}>
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
      <Field id="resellerSku" label="Reseller SKU" error={fe.resellerSku}>
        <Input id="resellerSku" name="resellerSku" defaultValue={initial.resellerSku ?? ''} />
      </Field>
      <Field id="titleAtSource" label="Title at source" error={fe.titleAtSource}>
        <Input id="titleAtSource" name="titleAtSource" defaultValue={initial.titleAtSource ?? ''} />
      </Field>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
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
