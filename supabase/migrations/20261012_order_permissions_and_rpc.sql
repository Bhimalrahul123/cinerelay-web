-- ==============================================================================
-- CineRelay Complete Database Migration: Order RLS, RPCs & Automatic Expiration
-- ==============================================================================
-- Apply this migration in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This enables seamless checkout order creation and payment verification.

-- 1. Ensure required columns exist on public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS razorpay_order_id text,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'card';

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders (razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders (buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing_id ON public.orders (listing_id);

-- 2. Grant Table Privileges to authenticated users
GRANT SELECT, INSERT, UPDATE ON TABLE public.orders TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.listings TO authenticated;

-- 3. Configure Row Level Security (RLS) on public.orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if they exist to avoid duplicate name conflicts
DROP POLICY IF EXISTS "Buyers and sellers can select their orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can insert their pending orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers can update their pending orders" ON public.orders;

-- RLS Policy: View orders
CREATE POLICY "Buyers and sellers can select their orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
);

-- RLS Policy: Insert pending order
CREATE POLICY "Buyers can insert their pending orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = buyer_id
);

-- RLS Policy: Update own pending order
CREATE POLICY "Buyers can update their pending orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  auth.uid() = buyer_id
);

-- 4. Secure RPC Function: Create Checkout Order
-- Runs with SECURITY DEFINER so permissions are guaranteed even if client RLS varies
CREATE OR REPLACE FUNCTION public.cinerelay_create_order(
  p_listing_id uuid,
  p_buyer_id uuid,
  p_payment_method text DEFAULT 'card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing record;
  v_order record;
  v_now timestamptz := now();
  v_expires_at timestamptz := now() + interval '30 minutes';
  v_amount_paise bigint;
BEGIN
  -- Authenticate caller if authenticated role
  IF auth.uid() IS NOT NULL AND auth.uid() != p_buyer_id THEN
    RETURN jsonb_build_object('error', 'Unauthorized buyer ID.');
  END IF;

  -- Select listing
  SELECT id, seller_id, title, price, status, event_date, event_time
  INTO v_listing
  FROM public.listings
  WHERE id = p_listing_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'This ticket could not be found.');
  END IF;

  IF v_listing.status != 'approved' THEN
    RETURN jsonb_build_object('error', 'This ticket is no longer available for purchase.');
  END IF;

  IF v_listing.seller_id = p_buyer_id THEN
    RETURN jsonb_build_object('error', 'You cannot purchase your own listing.');
  END IF;

  -- Check ticket event expiration (past date)
  IF v_listing.event_date IS NOT NULL AND v_listing.event_date < CURRENT_DATE THEN
    UPDATE public.listings SET status = 'expired' WHERE id = p_listing_id;
    RETURN jsonb_build_object('error', 'This ticket has already expired as the event date has passed.');
  END IF;

  v_amount_paise := round(v_listing.price * 100);

  -- Expire overdue pending orders on this listing
  UPDATE public.orders
  SET status = 'expired'
  WHERE listing_id = p_listing_id
    AND status = 'pending'
    AND expires_at <= v_now;

  -- Check for existing active pending orders on this listing
  SELECT id, buyer_id, amount_paise, expires_at
  INTO v_order
  FROM public.orders
  WHERE listing_id = p_listing_id
    AND status = 'pending'
    AND expires_at > v_now
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_order.buyer_id != p_buyer_id THEN
      RETURN jsonb_build_object('error', 'Another buyer is currently checking out this ticket. Please try again in a few minutes.');
    END IF;

    -- Return existing active order for this buyer
    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'amount_paise', v_order.amount_paise,
      'expires_at', v_order.expires_at,
      'seller_id', v_listing.seller_id,
      'reused', true
    );
  END IF;

  -- Insert new pending order
  INSERT INTO public.orders (
    listing_id,
    buyer_id,
    seller_id,
    amount_paise,
    currency,
    status,
    expires_at,
    payment_method
  )
  VALUES (
    p_listing_id,
    p_buyer_id,
    v_listing.seller_id,
    v_amount_paise,
    'INR',
    'pending',
    v_expires_at,
    p_payment_method
  )
  RETURNING id, amount_paise, expires_at INTO v_order;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'amount_paise', v_order.amount_paise,
    'expires_at', v_order.expires_at,
    'seller_id', v_listing.seller_id,
    'reused', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cinerelay_create_order TO authenticated, service_role;

-- 5. Secure RPC Function: Attach Razorpay Order ID
CREATE OR REPLACE FUNCTION public.cinerelay_attach_razorpay_order(
  p_order_id uuid,
  p_razorpay_order_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET razorpay_order_id = p_razorpay_order_id
  WHERE id = p_order_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cinerelay_attach_razorpay_order TO authenticated, service_role;

-- 6. Secure RPC Function: Confirm Card Payment
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

GRANT EXECUTE ON FUNCTION public.cinerelay_confirm_card_payment TO authenticated, service_role;

-- 7. Secure RPC Function: Automated Expiry of Past Listings
CREATE OR REPLACE FUNCTION public.cinerelay_expire_past_listings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.listings
  SET status = 'expired'
  WHERE status = 'approved'
    AND event_date IS NOT NULL
    AND event_date < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cinerelay_expire_past_listings TO authenticated, anon, service_role;
