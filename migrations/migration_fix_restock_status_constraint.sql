-- FIX: El constraint restock_sheets_status_check no incluye todos los estados
-- que el código envía. Se elimina y se vuelve a crear con los valores correctos.

ALTER TABLE public.restock_sheets
    DROP CONSTRAINT IF EXISTS restock_sheets_status_check;

ALTER TABLE public.restock_sheets
    ADD CONSTRAINT restock_sheets_status_check
    CHECK (status IN ('pending', 'approved', 'shipped', 'completed', 'rejected', 'cancelled'));
