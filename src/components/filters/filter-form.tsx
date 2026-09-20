"use client";

import { useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";

/**
 * A filter bar that refreshes the list below it in place. Pressing Enter in
 * the search box no longer reloads the page, so the caret, the scroll
 * position and every other field stay exactly where they were.
 *
 * It is still a real GET form underneath, so it works before hydration and
 * with JavaScript off.
 */
export function FilterForm({
  action,
  className,
  children,
  role,
}: {
  action: string;
  className?: string;
  children: ReactNode;
  role?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const params = new URLSearchParams();
    for (const [key, value] of new FormData(event.currentTarget)) {
      if (typeof value === "string" && value !== "") params.set(key, value);
    }

    // Leaving `page` out sends the reader back to the first page, which is
    // what a changed filter means.
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  return (
    <form
      action={action}
      aria-busy={pending || undefined}
      className={className}
      data-pending={pending ? "true" : undefined}
      method="get"
      onSubmit={apply}
      role={role}
    >
      {children}
    </form>
  );
}
