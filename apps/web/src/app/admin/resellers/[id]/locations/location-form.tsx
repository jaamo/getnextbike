'use client';

import { useActionState, useState } from 'react';
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
import type { LocationFormState } from './actions';

interface Props {
  action: (s: LocationFormState, fd: FormData) => Promise<LocationFormState>;
  regions: ReadonlyArray<{ id: string; label: string }>;
  kinds: readonly string[];
  statuses: readonly string[];
  robotsPolicies: readonly string[];
  initial?: Partial<{
    slug: string;
    name: string;
    regionId: string;
    kind: string;
    status: string;
    countryCode: string | null;
    countriesServed: string[];
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postalCode: string | null;
    latitude: string | null;
    longitude: string | null;
    phone: string | null;
    email: string | null;
    timezone: string | null;
    openingHoursJson: Record<string, unknown> | null;
    storefrontUrl: string | null;
    robotsPolicy: string | null;
    crawlRateLimitPerMin: number | null;
    rendersWithJs: boolean | null;
  }>;
  submitLabel: string;
  /** Disable changing kind after creation — switching erases the conditional fields. */
  kindLocked?: boolean;
}

export function LocationForm({
  action,
  regions,
  kinds,
  statuses,
  robotsPolicies,
  initial,
  submitLabel,
  kindLocked,
}: Props) {
  const [state, formAction, pending] = useActionState<LocationFormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const [kind, setKind] = useState<string>(initial?.kind ?? kinds[0] ?? 'online');
  const opening = initial?.openingHoursJson
    ? JSON.stringify(initial.openingHoursJson, null, 2)
    : '';

  return (
    <form action={formAction} className="max-w-xl space-y-4">
      <Field id="kind" label="Kind" error={fe.kind}>
        <Select name="kind" value={kind} onValueChange={setKind} disabled={kindLocked}>
          <SelectTrigger id="kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kinds.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {kindLocked ? (
          <p className="text-xs text-muted-foreground">
            Kind can't change after creation — delete and re-add if you need to switch.
          </p>
        ) : null}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="name" label="Name" error={fe.name}>
          <Input id="name" name="name" defaultValue={initial?.name ?? ''} required />
        </Field>
        <Field id="slug" label="Slug" error={fe.slug}>
          <Input id="slug" name="slug" defaultValue={initial?.slug ?? ''} required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="regionId" label="Region" error={fe.regionId}>
          <Select name="regionId" defaultValue={initial?.regionId ?? regions[0]?.id}>
            <SelectTrigger id="regionId">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {regions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="countryCode" label="Country code (ISO 3166-1 alpha-2)" error={fe.countryCode}>
          <Input
            id="countryCode"
            name="countryCode"
            maxLength={2}
            defaultValue={initial?.countryCode ?? ''}
            placeholder="FI"
          />
        </Field>
        <Field
          id="countriesServed"
          label="Countries served (comma-separated)"
          error={fe.countriesServed}
        >
          <Input
            id="countriesServed"
            name="countriesServed"
            defaultValue={initial?.countriesServed?.join(',') ?? ''}
            placeholder="FI,SE,DK"
          />
        </Field>
      </div>

      {kind === 'physical' ? (
        <fieldset className="space-y-4 rounded-md border p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">Physical store</legend>
          <Field id="addressLine1" label="Address line 1" error={fe.addressLine1}>
            <Input
              id="addressLine1"
              name="addressLine1"
              defaultValue={initial?.addressLine1 ?? ''}
            />
          </Field>
          <Field id="addressLine2" label="Address line 2" error={fe.addressLine2}>
            <Input
              id="addressLine2"
              name="addressLine2"
              defaultValue={initial?.addressLine2 ?? ''}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="city" label="City" error={fe.city}>
              <Input id="city" name="city" defaultValue={initial?.city ?? ''} />
            </Field>
            <Field id="postalCode" label="Postal code" error={fe.postalCode}>
              <Input id="postalCode" name="postalCode" defaultValue={initial?.postalCode ?? ''} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field id="latitude" label="Latitude" error={fe.latitude}>
              <Input id="latitude" name="latitude" defaultValue={initial?.latitude ?? ''} />
            </Field>
            <Field id="longitude" label="Longitude" error={fe.longitude}>
              <Input id="longitude" name="longitude" defaultValue={initial?.longitude ?? ''} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field id="phone" label="Phone" error={fe.phone}>
              <Input id="phone" name="phone" defaultValue={initial?.phone ?? ''} />
            </Field>
            <Field id="email" label="Email" error={fe.email}>
              <Input id="email" name="email" type="email" defaultValue={initial?.email ?? ''} />
            </Field>
          </div>
          <Field id="timezone" label="Timezone (IANA, e.g. Europe/Helsinki)" error={fe.timezone}>
            <Input id="timezone" name="timezone" defaultValue={initial?.timezone ?? ''} />
          </Field>
          <Field id="openingHoursJson" label="Opening hours JSON" error={fe.openingHoursJson}>
            <Textarea
              id="openingHoursJson"
              name="openingHoursJson"
              defaultValue={opening}
              rows={4}
              className="font-mono text-xs"
              placeholder='{"mon":["10:00","18:00"], …}'
            />
          </Field>
        </fieldset>
      ) : (
        <fieldset className="space-y-4 rounded-md border p-4">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            Online storefront
          </legend>
          <Field id="storefrontUrl" label="Storefront URL" error={fe.storefrontUrl}>
            <Input
              id="storefrontUrl"
              name="storefrontUrl"
              type="url"
              defaultValue={initial?.storefrontUrl ?? ''}
              required
              placeholder="https://store.example.com"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="robotsPolicy" label="Robots policy" error={fe.robotsPolicy}>
              <Select name="robotsPolicy" defaultValue={initial?.robotsPolicy ?? 'respect'}>
                <SelectTrigger id="robotsPolicy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {robotsPolicies.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="crawlRateLimitPerMin"
              label="Crawl rate limit (req/min)"
              error={fe.crawlRateLimitPerMin}
            >
              <Input
                id="crawlRateLimitPerMin"
                name="crawlRateLimitPerMin"
                type="number"
                min={1}
                max={600}
                defaultValue={initial?.crawlRateLimitPerMin ?? 10}
              />
            </Field>
          </div>
          <Field id="rendersWithJs" label="Requires JS rendering" error={fe.rendersWithJs}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="rendersWithJs"
                defaultChecked={!!initial?.rendersWithJs}
                className="h-4 w-4"
              />
              <span>Use Playwright (headless Chromium) instead of HTTP fetch</span>
            </label>
          </Field>
        </fieldset>
      )}

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
