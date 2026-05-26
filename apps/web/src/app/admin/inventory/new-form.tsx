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
import { createInventoryAction, type InventoryCreateState } from './actions';

interface Props {
  onlineLocations: ReadonlyArray<{ id: string; label: string }>;
}

export function NewInventoryForm({ onlineLocations }: Props) {
  const [state, formAction, pending] = useActionState<InventoryCreateState, FormData>(
    createInventoryAction,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="resellerLocationId" label="Online storefront" error={fe.resellerLocationId}>
        <Select name="resellerLocationId" defaultValue={onlineLocations[0]?.id}>
          <SelectTrigger id="resellerLocationId">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {onlineLocations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field id="productUrl" label="Product URL" error={fe.productUrl}>
        <Input id="productUrl" name="productUrl" type="url" required placeholder="https://…" />
      </Field>
      <Field id="resellerSku" label="Reseller SKU (optional)" error={fe.resellerSku}>
        <Input id="resellerSku" name="resellerSku" />
      </Field>
      <Field
        id="titleAtSource"
        label="Title as shown on the page (optional, helps variant matching)"
        error={fe.titleAtSource}
      >
        <Input id="titleAtSource" name="titleAtSource" />
      </Field>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Register'}
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
