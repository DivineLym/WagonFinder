-- Auto-reject competing pending requests when a contract is created.
-- Also increments quantity_fulfilled and marks order as fulfilled when plan is met.

CREATE OR REPLACE FUNCTION fn_auto_reject_on_contract_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_wagon_id        uuid;
  v_gu12_order_id   uuid;
  v_wagon_owner_id  uuid;
  v_qty_planned     int;
  v_qty_fulfilled   int;
BEGIN
  -- Look up wagon/order from wagon_owner_pending_requests
  SELECT wagon_id, gu12_order_id, wagon_owner_id
  INTO v_wagon_id, v_gu12_order_id, v_wagon_owner_id
  FROM public.wagon_owner_pending_requests
  WHERE id = NEW.application_id;

  -- Fall back to shipper_pending_requests
  IF v_wagon_id IS NULL THEN
    SELECT wagon_id, gu12_order_id, wagon_owner_id
    INTO v_wagon_id, v_gu12_order_id, v_wagon_owner_id
    FROM public.shipper_pending_requests
    WHERE id = NEW.application_id;
  END IF;

  IF v_wagon_id IS NULL OR v_gu12_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Increment quantity_fulfilled on the order
  UPDATE public.gu12_orders
  SET quantity_fulfilled = quantity_fulfilled + 1
  WHERE id = v_gu12_order_id
  RETURNING quantity_planned, quantity_fulfilled
  INTO v_qty_planned, v_qty_fulfilled;

  -- 2. Reject all OTHER pending apps for this wagon (any order)
  INSERT INTO public.wagon_owner_rejected_requests (gu12_order_id, wagon_owner_id, wagon_id, message)
  SELECT gu12_order_id, wagon_owner_id, wagon_id, 'Вагон принят на другой груз'
  FROM public.wagon_owner_pending_requests
  WHERE wagon_id = v_wagon_id AND id != NEW.application_id;

  DELETE FROM public.wagon_owner_pending_requests
  WHERE wagon_id = v_wagon_id AND id != NEW.application_id;

  -- 3. If plan is now fulfilled, reject remaining apps for this order and close it
  IF v_qty_fulfilled >= v_qty_planned THEN
    INSERT INTO public.wagon_owner_rejected_requests (gu12_order_id, wagon_owner_id, wagon_id, message)
    SELECT gu12_order_id, wagon_owner_id, wagon_id, 'Потребность в вагонах выполнена'
    FROM public.wagon_owner_pending_requests
    WHERE gu12_order_id = v_gu12_order_id;

    DELETE FROM public.wagon_owner_pending_requests
    WHERE gu12_order_id = v_gu12_order_id;

    UPDATE public.gu12_orders
    SET status = 'fulfilled', is_public = false
    WHERE id = v_gu12_order_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_reject_on_contract ON public.contracts;

CREATE TRIGGER trg_auto_reject_on_contract
AFTER INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION fn_auto_reject_on_contract_insert();
