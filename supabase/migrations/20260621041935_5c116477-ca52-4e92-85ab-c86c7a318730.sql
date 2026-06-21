
CREATE OR REPLACE FUNCTION public._prevent_support_message_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'support_ticket_messages is append-only';
END;$$;

CREATE OR REPLACE FUNCTION public._prevent_support_event_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'support_ticket_events is append-only';
END;$$;
