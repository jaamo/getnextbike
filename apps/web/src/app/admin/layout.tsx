import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { signOutAction } from '@/lib/actions';
import { auth } from '@/lib/auth';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/models', label: 'Models' },
  { href: '/admin/model-years', label: 'Model years' },
  { href: '/admin/model-variants', label: 'Variants' },
  { href: '/admin/components', label: 'Components' },
  { href: '/admin/regions', label: 'Regions' },
  { href: '/admin/audit-log', label: 'Audit log' },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=/admin');

  return (
    <div className="min-h-screen grid grid-cols-[14rem_1fr]">
      <aside className="border-r bg-muted/40 px-4 py-6 flex flex-col">
        <div className="text-sm font-semibold tracking-tight">GetNextBike</div>
        <div className="text-xs text-muted-foreground mt-0.5">{session.user.email}</div>
        <Separator className="my-4" />
        <nav className="flex flex-col gap-0.5 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-4">
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="px-8 py-8">{children}</main>
    </div>
  );
}
