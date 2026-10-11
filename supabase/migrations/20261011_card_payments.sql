-- CineRelay Database Migration: Credit/Debit Card Payments & Order Enhancements
-- Apply this migration in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Add columns for Razorpay order ID and payment method if they don't already exist
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS razorpay_order_id text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'upi_qr';

-- 2. Indexes for fast lookup by payment references and foreign keys
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_qr_id ON public.orders (razorpay_qr_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing_id ON public.orders (listing_id);

-- 3. Secure RPC function to confirm Card/Standard Checkout payments
CREATE OR REPLACE FUNCTION public.cinerelay_confirm_card_payment(
  p_order_id uuid,
  p_payment_id text,
  p_razorpay_order_id text,
  p_amount_paise bigint
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
BEGIN
  -- Lock the order row for safe concurrency
  SELECT id, listing_id, amount_paise, status INTO v_order
  FROM public.orders
  WHERE id = p_order_id
    AND (razorpay_order_id = p_razorpay_order_id OR razorpay_qr_id = p_razorpay_order_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Idempotency check: if already paid, return true
  IF v_order.status = 'paid' THEN
    RETURN true;
  END IF;

  -- Verify amount match
  IF v_order.amount_paise != p_amount_paise THEN
    RETURN false;
  END IF;

  -- Update order status
  UPDATE public.orders
  SET status = 'paid',
      razorpay_payment_id = p_payment_id,
      paid_at = now()
  WHERE id = p_order_id;

  -- Mark listing as sold
  UPDATE public.listings
  SET status = 'sold'
  WHERE id = v_order.listing_id;

  RETURN true;
END;
$$;

-- Restrict execution to service_role (server-only)
REVOKE EXECUTE ON FUNCTION public.cinerelay_confirm_card_payment FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cinerelay_confirm_card_payment TO service_role;
