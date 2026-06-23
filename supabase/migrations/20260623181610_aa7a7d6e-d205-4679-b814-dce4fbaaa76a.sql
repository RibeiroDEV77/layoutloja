
CREATE OR REPLACE FUNCTION public.product_color_media_strip_private_urls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_match text;
BEGIN
  -- external_url
  IF NEW.external_url IS NOT NULL THEN
    v_match := substring(NEW.external_url FROM '/object/(?:sign|authenticated)/dam/([^?#]+)');
    IF v_match IS NOT NULL THEN
      IF NEW.storage_path IS NULL OR NEW.storage_path = '' THEN
        NEW.storage_path := v_match;
      END IF;
      NEW.external_url := NULL;
    END IF;
  END IF;

  -- thumbnail_url
  IF NEW.thumbnail_url IS NOT NULL THEN
    v_match := substring(NEW.thumbnail_url FROM '/object/(?:sign|authenticated)/dam/([^?#]+)');
    IF v_match IS NOT NULL THEN
      IF NEW.storage_path IS NULL OR NEW.storage_path = '' THEN
        NEW.storage_path := v_match;
      END IF;
      NEW.thumbnail_url := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_color_media_strip_private_urls ON public.product_color_media;
CREATE TRIGGER trg_product_color_media_strip_private_urls
BEFORE INSERT OR UPDATE OF external_url, thumbnail_url, storage_path
ON public.product_color_media
FOR EACH ROW EXECUTE FUNCTION public.product_color_media_strip_private_urls();
