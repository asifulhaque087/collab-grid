"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShoppingBag, Download, CheckCircle2, ArrowLeft, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField, FormRow } from "@/components/ui/form-field";
import { createOrder } from "@/actions/orders";
import { CHECKOUT_CART_KEY, type CheckoutCart } from "@/types/realtime";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const schema = z.object({
  // Trimmed shipping form: email (optional), phone, address.
  email: z.union([z.string().email("Enter a valid email"), z.literal("")]).optional(),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  cardNumber: z.string().regex(/^\d{13,19}$/, "Enter a valid card number"),
  cardExp: z.string().regex(/^\d{2}\/\d{2}$/, "MM/YY"),
  cardCvc: z.string().regex(/^\d{3,4}$/, "CVC"),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_SNAPSHOT = "";

function formatLock(seconds: number) {
  if (seconds <= 0) return "Expired";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Slug + origin captured on success so the screen can link back to the right
  // board route (public shopper vs tenant dashboard) after the cart clears.
  const [doneSlug, setDoneSlug] = useState<string | null>(null);
  const [doneEndUser, setDoneEndUser] = useState(false);

  // One idempotency key per checkout session — reused across retries/double
  // clicks so the server dedupes instead of double-charging.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" ? crypto.randomUUID() : "",
  );

  // Read the cart from sessionStorage without an effect (SSR-safe: null on the
  // server, the stored value on the client).
  const rawCart = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(CHECKOUT_CART_KEY) ?? EMPTY_SNAPSHOT,
    () => EMPTY_SNAPSHOT,
  );
  const cart = useMemo<CheckoutCart | null>(
    () => (rawCart ? (JSON.parse(rawCart) as CheckoutCart) : null),
    [rawCart],
  );

  const total = useMemo(
    () => cart?.items.reduce((sum, i) => sum + i.price, 0) ?? 0,
    [cart],
  );

  // Live countdown to the hard-lock expiry so the shopper sees how long their
  // reservation has left while filling in the form.
  const [secondsLeft, setSecondsLeft] = useState(() =>
    cart?.expiresAt ? Math.max(0, Math.round((cart.expiresAt - Date.now()) / 1000)) : 0,
  );
  useEffect(() => {
    if (!cart?.expiresAt) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((cart.expiresAt - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [cart?.expiresAt]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = (values: FormValues) => {
    if (!cart) return;
    startTransition(async () => {
      const result = await createOrder({
        idempotencyKey,
        boardId: cart.boardId,
        buyerUserId: cart.buyerUserId,
        widgetIds: cart.items.map((i) => i.id),
        email: values.email || undefined,
        phone: values.phone,
        address: values.address,
        cardLast4: values.cardNumber.slice(-4),
      });

      if (!result.success || !result.data) {
        toast.error(result.error ?? "Payment failed");
        return;
      }
      if (result.data.duplicate) {
        toast.info("This order was already placed.");
      } else {
        toast.success("Payment successful — your items are confirmed.");
      }
      setDoneSlug(cart.slug);
      setDoneEndUser(cart.endUser);
      sessionStorage.removeItem(CHECKOUT_CART_KEY);
      setOrderId(result.data.orderId);
    });
  };

  // ── Success screen ────────────────────────────────────
  if (orderId) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
        <CheckCircle2 className="size-16 text-committed" />
        <div>
          <h1 className="text-2xl font-bold">Order confirmed</h1>
          <p className="mt-1 text-sm text-text-muted">
            Order <span className="font-mono">{orderId}</span>
          </p>
        </div>
        <a href={`${API_URL}/orders/${orderId}/invoice`} target="_blank" rel="noreferrer">
          <Button>
            <Download />
            Download PDF invoice
          </Button>
        </a>
        <button
          className="text-sm text-text-muted underline hover:text-text"
          onClick={() => {
            if (!doneSlug) return router.push(doneEndUser ? "/" : "/dashboard/boards");
            router.push(doneEndUser ? `/b/${doneSlug}` : `/dashboard/boards/${doneSlug}`);
          }}
        >
          Back to board
        </button>
      </div>
    );
  }

  // ── Empty cart ────────────────────────────────────────
  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <ShoppingBag className="size-12 text-border" />
        <h1 className="text-xl font-semibold">No items to check out</h1>
        <p className="text-sm text-text-muted">
          Lock items on a board and click checkout to reserve them.
        </p>
        <Button variant="secondary" onClick={() => router.push("/dashboard/boards")}>
          <ArrowLeft />
          Back to boards
        </Button>
      </div>
    );
  }

  // ── Checkout form ─────────────────────────────────────
  return (
    <div className="mx-auto grid min-h-screen max-w-4xl gap-8 px-4 py-10 md:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit(onSubmit)}>
        <h1 className="mb-6 text-2xl font-bold">Checkout</h1>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Shipping
        </h2>
        <FormField label="Email (optional)" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <Input id="phone" inputMode="tel" {...register("phone")} />
        </FormField>
        <FormField label="Address" htmlFor="address" error={errors.address?.message}>
          <Input id="address" {...register("address")} />
        </FormField>

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Payment (demo card)
        </h2>
        <FormField label="Card number" htmlFor="cardNumber" error={errors.cardNumber?.message}>
          <Input id="cardNumber" inputMode="numeric" placeholder="4242424242424242" {...register("cardNumber")} />
        </FormField>
        <FormRow>
          <FormField label="Expiry" htmlFor="cardExp" error={errors.cardExp?.message}>
            <Input id="cardExp" placeholder="MM/YY" {...register("cardExp")} />
          </FormField>
          <FormField label="CVC" htmlFor="cardCvc" error={errors.cardCvc?.message}>
            <Input id="cardCvc" inputMode="numeric" placeholder="123" {...register("cardCvc")} />
          </FormField>
        </FormRow>

        <Button type="submit" className="mt-2 w-full justify-center" disabled={pending}>
          <ShoppingBag />
          {pending ? "Processing…" : `Pay ৳${total.toLocaleString()}`}
        </Button>
      </form>

      <aside className="h-fit rounded-md border border-border bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Your reserved items
          </h2>
          <span
            className={`flex items-center gap-1 font-mono text-sm font-bold ${
              secondsLeft <= 30 ? "text-danger" : "text-soft-lock"
            }`}
          >
            <Clock className="size-4" />
            {formatLock(secondsLeft)}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {cart.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="size-11 shrink-0 overflow-hidden rounded-sm border border-border bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.img} alt={item.name} className="size-full object-cover" />
              </div>
              <span className="flex-1 truncate">{item.name}</span>
              <span className="font-mono">৳{item.price.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 font-semibold">
          <span>Total</span>
          <span className="font-mono">৳{total.toLocaleString()}</span>
        </div>
        <p className="mt-3 text-[0.72rem] text-soft-lock">
          Complete payment before the timer runs out to keep your reservation.
        </p>
      </aside>
    </div>
  );
}
