
CREATE OR REPLACE FUNCTION public.validate_product_color_media()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF new.media_type IN ('image','video') THEN
    IF (new.storage_path IS NULL OR length(new.storage_path) = 0)
       AND (new.external_url IS NULL OR length(new.external_url) = 0)
       AND (new.external_id  IS NULL OR length(new.external_id)  = 0) THEN
      RAISE EXCEPTION 'É necessário informar storage_path OU external_url/external_id para media_type=%', new.media_type;
    END IF;
  END IF;
  IF new.media_type IN ('youtube','vimeo') AND (new.external_id IS NULL OR length(new.external_id) = 0) THEN
    RAISE EXCEPTION 'external_id é obrigatório para media_type=%', new.media_type;
  END IF;
  RETURN new;
END;
$function$;
