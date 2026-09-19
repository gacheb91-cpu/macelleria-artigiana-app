-- Macelleria Artigiana: referral. Eseguire una volta, prima delle app.
-- Transazione: in caso di errore non vengono applicate modifiche parziali.
BEGIN;
CREATE TABLE public.ma_partner (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), azienda_id uuid NOT NULL REFERENCES public.aziende(id),
 nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 1 AND 120),
 UNIQUE(azienda_id,nome)
);
CREATE TABLE public.ma_referral_codici (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), partner_id uuid NOT NULL REFERENCES public.ma_partner(id),
 codice text NOT NULL UNIQUE CHECK (codice ~ '^[A-Z0-9_-]{3,32}$'),
 percentuale numeric(5,2) NOT NULL CHECK(percentuale BETWEEN 0 AND 100), attivo boolean NOT NULL DEFAULT true
);
CREATE TABLE public.ma_referral_mesi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), azienda_id uuid NOT NULL REFERENCES public.aziende(id),
 partner_id uuid NOT NULL REFERENCES public.ma_partner(id), mese date NOT NULL CHECK(extract(day FROM mese)=1),
 chiuso_at timestamptz NOT NULL DEFAULT now(), pagato_at timestamptz, totale numeric(14,2) NOT NULL,
 UNIQUE(partner_id,mese)
);
CREATE TABLE public.ma_referral_ordini (
 ordine_id uuid PRIMARY KEY REFERENCES public.ordini(id), azienda_id uuid NOT NULL REFERENCES public.aziende(id),
 codice_id uuid REFERENCES public.ma_referral_codici(id), codice text, partner_id uuid REFERENCES public.ma_partner(id),
 percentuale numeric(5,2) NOT NULL DEFAULT 0 CHECK(percentuale BETWEEN 0 AND 100),
 usato_at timestamptz NOT NULL DEFAULT now(), prodotti_finale numeric(14,2), consegna numeric(14,2) NOT NULL DEFAULT 0,
 commissione numeric(14,2) NOT NULL DEFAULT 0, pagato_at timestamptz, annullato boolean NOT NULL DEFAULT false,
 chiusura_id uuid REFERENCES public.ma_referral_mesi(id),
 CHECK(prodotti_finale >= 0), CHECK(consegna >= 0), CHECK(commissione >= 0)
);
CREATE INDEX ON public.ma_referral_ordini(azienda_id,pagato_at);
CREATE INDEX ON public.ma_referral_ordini(partner_id,usato_at);
ALTER TABLE public.ma_partner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_referral_codici ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_referral_mesi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ma_referral_ordini ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ma_partner,public.ma_referral_codici,public.ma_referral_mesi,public.ma_referral_ordini FROM anon,authenticated;
-- Tutti gli accessi passano da funzioni con controllo del profilo amministratore.
CREATE FUNCTION public.ma_referral_admin() RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid;
BEGIN
 SELECT azienda_id INTO a FROM public.profili WHERE id=auth.uid() AND attivo AND ruolo='amministratore';
 IF a IS NULL THEN RAISE EXCEPTION 'Accesso riservato all’amministratore'; END IF;
 RETURN a;
END $$;
CREATE FUNCTION public.ma_referral_gestisci(p_azione text,p_id uuid DEFAULT NULL,p_nome text DEFAULT NULL,p_codice text DEFAULT NULL,p_percentuale numeric DEFAULT NULL,p_attivo boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; partner uuid;
BEGIN
 a:=public.ma_referral_admin(); PERFORM pg_advisory_xact_lock(hashtextextended(a::text,71));
 IF p_azione='crea' THEN
  IF nullif(trim(p_nome),'') IS NULL THEN RAISE EXCEPTION 'Nome partner obbligatorio'; END IF;
  INSERT INTO public.ma_partner(azienda_id,nome) VALUES(a,trim(p_nome)) ON CONFLICT(azienda_id,nome) DO UPDATE SET nome=excluded.nome RETURNING id INTO partner;
  INSERT INTO public.ma_referral_codici(partner_id,codice,percentuale) VALUES(partner,upper(trim(p_codice)),p_percentuale);
 ELSIF p_azione IN ('modifica','elimina') THEN
  IF NOT EXISTS(SELECT 1 FROM public.ma_referral_codici c JOIN public.ma_partner p ON p.id=c.partner_id WHERE c.id=p_id AND p.azienda_id=a) THEN RAISE EXCEPTION 'Codice non trovato'; END IF;
  IF p_azione='elimina' THEN
   IF EXISTS(SELECT 1 FROM public.ma_referral_ordini WHERE codice_id=p_id) THEN RAISE EXCEPTION 'Codice utilizzato: disattivalo per conservare lo storico'; END IF;
   DELETE FROM public.ma_referral_codici WHERE id=p_id;
  ELSE
   UPDATE public.ma_referral_codici SET percentuale=p_percentuale,attivo=p_attivo WHERE id=p_id;
  END IF;
 ELSE RAISE EXCEPTION 'Operazione non valida'; END IF;
END $$;
CREATE FUNCTION public.ma_referral_verifica(p_codice text) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM public.ma_referral_codici c JOIN public.ma_partner p ON p.id=c.partner_id
 WHERE c.codice=upper(trim(p_codice)) AND c.attivo AND p.azienda_id='64df3901-1cc2-4356-8a80-1b6a757a824e');
$$;
-- Totale definitivo e conferma pagamento sono atomici; una ripetizione non duplica le commissioni.
CREATE FUNCTION public.ma_referral_completa(p_ordine uuid,p_prodotti numeric,p_consegna numeric,p_pagato boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; o public.ordini; r public.ma_referral_ordini; m date;
BEGIN
 a:=public.ma_referral_admin(); PERFORM pg_advisory_xact_lock(hashtextextended(a::text,71));
 SELECT * INTO o FROM public.ordini WHERE id=p_ordine AND azienda_id=a FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ordine non trovato'; END IF;
 IF o.stato::text NOT IN ('pronto','completato') THEN RAISE EXCEPTION 'L’ordine deve essere pronto'; END IF;
 IF p_pagato IS DISTINCT FROM true THEN RAISE EXCEPTION 'Conferma il pagamento'; END IF;
 IF p_prodotti IS NULL OR p_prodotti<0 OR p_prodotti>9999999 OR p_prodotti::text='NaN' OR p_consegna IS NULL OR p_consegna<0 OR p_consegna>9999999 OR p_consegna::text='NaN' THEN RAISE EXCEPTION 'Importo non valido'; END IF;
 INSERT INTO public.ma_referral_ordini(ordine_id,azienda_id) VALUES(p_ordine,a) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM public.ma_referral_ordini WHERE ordine_id=p_ordine FOR UPDATE;
 IF r.chiusura_id IS NOT NULL THEN RAISE EXCEPTION 'Mese chiuso: importi bloccati'; END IF;
 m:=date_trunc('month',coalesce(r.pagato_at,now()) AT TIME ZONE 'Europe/Rome')::date;
 IF EXISTS(SELECT 1 FROM public.ma_referral_mesi WHERE partner_id=r.partner_id AND mese=m) THEN RAISE EXCEPTION 'Periodo già chiuso'; END IF;
 UPDATE public.ma_referral_ordini SET prodotti_finale=round(p_prodotti,2),consegna=round(p_consegna,2),
 commissione=round(round(p_prodotti,2)*percentuale/100,2),pagato_at=coalesce(pagato_at,now()),annullato=false WHERE ordine_id=p_ordine;
 UPDATE public.ordini SET totale=round(p_prodotti,2)+round(p_consegna,2),stato='completato',completato_at=coalesce(completato_at,now()),updated_at=now() WHERE id=p_ordine;
END $$;
CREATE FUNCTION public.ma_referral_collega(p_ordine uuid,p_codice text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; ref record;
BEGIN
 a:=public.ma_referral_admin(); PERFORM pg_advisory_xact_lock(hashtextextended(a::text,71));
 PERFORM 1 FROM public.ordini WHERE id=p_ordine AND azienda_id=a AND stato::text NOT IN ('completato','annullato') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ordine non modificabile'; END IF;
 IF EXISTS(SELECT 1 FROM public.ma_referral_ordini WHERE ordine_id=p_ordine AND codice_id IS NOT NULL) THEN RAISE EXCEPTION 'Questo ordine ha già un codice partner'; END IF;
 IF EXISTS(SELECT 1 FROM public.ma_referral_ordini WHERE ordine_id=p_ordine AND (pagato_at IS NOT NULL OR chiusura_id IS NOT NULL)) THEN RAISE EXCEPTION 'Ordine già contabilizzato'; END IF;
 SELECT c.*,p.azienda_id INTO ref FROM public.ma_referral_codici c JOIN public.ma_partner p ON p.id=c.partner_id WHERE c.codice=upper(trim(p_codice)) AND c.attivo AND p.azienda_id=a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Codice non valido o disattivato'; END IF;
 INSERT INTO public.ma_referral_ordini(ordine_id,azienda_id,codice_id,codice,partner_id,percentuale) VALUES(p_ordine,a,ref.id,ref.codice,ref.partner_id,ref.percentuale)
 ON CONFLICT(ordine_id) DO UPDATE SET codice_id=excluded.codice_id,codice=excluded.codice,partner_id=excluded.partner_id,percentuale=excluded.percentuale;
END $$;
-- Annullamenti e cambi stato non devono lasciare commissioni maturate per errore.
CREATE FUNCTION public.ma_referral_stato_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.ma_referral_ordini;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(OLD.azienda_id::text,71));
 SELECT * INTO r FROM public.ma_referral_ordini WHERE ordine_id=OLD.id FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF r.chiusura_id IS NOT NULL AND (NEW.stato IS DISTINCT FROM OLD.stato OR NEW.totale IS DISTINCT FROM OLD.totale OR NEW.azienda_id IS DISTINCT FROM OLD.azienda_id OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id) THEN
 RAISE EXCEPTION 'Ordine in un riepilogo chiuso: registrare una rettifica separata'; END IF;
 IF NEW.stato::text='completato' AND (r.pagato_at IS NULL OR r.annullato) THEN RAISE EXCEPTION 'Usa la conferma importo e pagamento'; END IF;
 IF r.pagato_at IS NOT NULL AND NOT r.annullato AND NEW.stato::text='completato' AND NEW.totale IS DISTINCT FROM r.prodotti_finale+r.consegna THEN RAISE EXCEPTION 'Modifica il totale tramite la conferma importo'; END IF;
 IF NEW.stato IS DISTINCT FROM OLD.stato AND NEW.stato::text<>'completato' THEN
  UPDATE public.ma_referral_ordini SET annullato=true WHERE ordine_id=OLD.id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ma_referral_stato_guard BEFORE UPDATE ON public.ordini FOR EACH ROW EXECUTE FUNCTION public.ma_referral_stato_guard();
CREATE FUNCTION public.ma_referral_chiudi(p_partner uuid,p_mese date) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; id_mese uuid; totale_mese numeric;
BEGIN
 a:=public.ma_referral_admin(); PERFORM pg_advisory_xact_lock(hashtextextended(a::text,71));
 IF p_mese IS NULL OR extract(day FROM p_mese)<>1 OR p_mese>=date_trunc('month',now() AT TIME ZONE 'Europe/Rome')::date THEN RAISE EXCEPTION 'Puoi chiudere solo un mese terminato'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.ma_partner WHERE id=p_partner AND azienda_id=a) THEN RAISE EXCEPTION 'Partner non trovato'; END IF;
 SELECT id INTO id_mese FROM public.ma_referral_mesi WHERE partner_id=p_partner AND mese=p_mese;
 IF FOUND THEN RETURN id_mese; END IF;
 SELECT coalesce(sum(commissione),0) INTO totale_mese FROM public.ma_referral_ordini WHERE partner_id=p_partner AND NOT annullato AND pagato_at IS NOT NULL AND date_trunc('month',pagato_at AT TIME ZONE 'Europe/Rome')::date=p_mese;
 INSERT INTO public.ma_referral_mesi(azienda_id,partner_id,mese,totale) VALUES(a,p_partner,p_mese,totale_mese) RETURNING id INTO id_mese;
 UPDATE public.ma_referral_ordini SET chiusura_id=id_mese WHERE partner_id=p_partner AND pagato_at IS NOT NULL AND NOT annullato AND date_trunc('month',pagato_at AT TIME ZONE 'Europe/Rome')::date=p_mese;
 RETURN id_mese;
END $$;
CREATE FUNCTION public.ma_referral_paga(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid;
BEGIN
 a:=public.ma_referral_admin();
 UPDATE public.ma_referral_mesi SET pagato_at=coalesce(pagato_at,now()) WHERE id=p_id AND azienda_id=a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Riepilogo non trovato'; END IF;
END $$;
-- Dati per MA Manager: nessuna tabella referral è esposta ai clienti anonimi.
CREATE FUNCTION public.ma_referral_dati(p_mese date DEFAULT NULL,p_ordine uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a uuid; m date; result jsonb;
BEGIN
 a:=public.ma_referral_admin(); m:=coalesce(p_mese,date_trunc('month',now() AT TIME ZONE 'Europe/Rome')::date);
 SELECT jsonb_build_object(
 'codici',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.partner,x.codice),'[]') FROM (SELECT c.*,p.nome AS partner FROM public.ma_referral_codici c JOIN public.ma_partner p ON p.id=c.partner_id WHERE p.azienda_id=a) x),
 'mesi',(SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') FROM public.ma_referral_mesi x WHERE x.azienda_id=a AND x.mese=m),
 'ordini',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.usato_at),'[]') FROM (
 SELECT r.*,o.numero_ordine,o.stato,coalesce(cl.nome,'')||' '||coalesce(cl.cognome,'') AS cliente,p.nome AS partner
 FROM public.ma_referral_ordini r JOIN public.ordini o ON o.id=r.ordine_id LEFT JOIN public.clienti cl ON cl.id=o.cliente_id LEFT JOIN public.ma_partner p ON p.id=r.partner_id
 WHERE r.azienda_id=a AND ((p_ordine IS NOT NULL AND r.ordine_id=p_ordine) OR (p_ordine IS NULL AND (date_trunc('month',r.usato_at AT TIME ZONE 'Europe/Rome')::date=m OR date_trunc('month',r.pagato_at AT TIME ZONE 'Europe/Rome')::date=m)))
 ) x)) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.crea_ordine_pubblico_referral(p_nome text, p_cognome text DEFAULT NULL::text, p_telefono text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_modalita text DEFAULT 'ritiro'::text, p_indirizzo text DEFAULT NULL::text, p_citta text DEFAULT NULL::text, p_cap text DEFAULT NULL::text, p_data_consegna date DEFAULT NULL::date, p_ora_consegna time without time zone DEFAULT NULL::time without time zone, p_note text DEFAULT NULL::text, p_righe jsonb DEFAULT '[]'::jsonb, p_codice_referral text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_azienda_id uuid := '64df3901-1cc2-4356-8a80-1b6a757a824e';
  v_ref record;
  v_cliente_id uuid;
  v_ordine_id uuid;
  v_numero_ordine bigint;
  v_totale numeric := 0;

  v_riga jsonb;
  v_prodotto record;
  v_quantita numeric;
  v_subtotale numeric;
begin

  PERFORM pg_advisory_xact_lock(hashtextextended(v_azienda_id::text,71));
  IF nullif(trim(p_codice_referral),'') IS NOT NULL THEN
    SELECT c.* INTO v_ref FROM public.ma_referral_codici c JOIN public.ma_partner p ON p.id=c.partner_id
    WHERE c.codice=upper(trim(p_codice_referral)) AND c.attivo AND p.azienda_id=v_azienda_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Codice partner non valido o disattivato'; END IF;
  END IF;
  -- CONTROLLI DATI CLIENTE
  if nullif(trim(p_nome), '') is null then
    raise exception 'Nome cliente obbligatorio';
  end if;

  if nullif(trim(p_telefono), '') is null
     and nullif(trim(p_email), '') is null then
    raise exception 'Inserire almeno telefono o email';
  end if;

  if p_modalita not in ('ritiro', 'consegna') then
    raise exception 'Modalità non valida';
  end if;

  if p_modalita = 'consegna'
     and nullif(trim(p_indirizzo), '') is null then
    raise exception 'Indirizzo obbligatorio per la consegna';
  end if;

  if p_modalita = 'consegna'
     and nullif(trim(p_citta), '') is null then
    raise exception 'Città obbligatoria per la consegna';
  end if;

  if p_modalita = 'consegna'
     and nullif(trim(p_cap), '') is null then
    raise exception 'CAP obbligatorio per la consegna';
  end if;

  if jsonb_typeof(p_righe) <> 'array'
     or jsonb_array_length(p_righe) = 0 then
    raise exception 'Ordine senza prodotti';
  end if;


  -- CERCA CLIENTE ESISTENTE
  select id
  into v_cliente_id
  from public.clienti
  where azienda_id = v_azienda_id
    and attivo = true
    and (
      (
        nullif(trim(p_telefono), '') is not null
        and telefono = trim(p_telefono)
      )
      or
      (
        nullif(trim(p_email), '') is not null
        and lower(email) = lower(trim(p_email))
      )
    )
  order by created_at
  limit 1;


  -- SE NON ESISTE, CREA IL CLIENTE
  if v_cliente_id is null then

    insert into public.clienti (
      azienda_id,
      nome,
      cognome,
      telefono,
      email,
      indirizzo,
      citta,
      cap
    )
    values (
      v_azienda_id,
      trim(p_nome),
      nullif(trim(p_cognome), ''),
      nullif(trim(p_telefono), ''),
      nullif(trim(p_email), ''),
      nullif(trim(p_indirizzo), ''),
      nullif(trim(p_citta), ''),
      nullif(trim(p_cap), '')
    )
    returning id into v_cliente_id;

  end if;


  -- GENERA NUMERO ORDINE
  perform pg_advisory_xact_lock(64157550122);

  select coalesce(max(numero_ordine), 0) + 1
  into v_numero_ordine
  from public.ordini
  where azienda_id = v_azienda_id;


  -- CREA ORDINE
  insert into public.ordini (
    azienda_id,
    cliente_id,
    numero_ordine,
    stato,
    totale,
    modalita,
    data_consegna,
    ora_consegna,
    indirizzo_consegna,
    citta_consegna,
    cap_consegna,
    note_cliente
  )
  values (
    v_azienda_id,
    v_cliente_id,
    v_numero_ordine,
    'ricevuto',
    0,
    p_modalita::modalita_consegna,
    p_data_consegna,
    p_ora_consegna,

    case
      when p_modalita = 'consegna'
      then nullif(trim(p_indirizzo), '')
      else null
    end,

    case
      when p_modalita = 'consegna'
      then nullif(trim(p_citta), '')
      else null
    end,

    case
      when p_modalita = 'consegna'
      then nullif(trim(p_cap), '')
      else null
    end,

    nullif(trim(p_note), '')
  )
  returning id into v_ordine_id;


  -- CREA LE RIGHE DELL'ORDINE
  for v_riga in
    select value
    from jsonb_array_elements(p_righe)
  loop

    if nullif(v_riga->>'prodotto_id', '') is null then
      raise exception 'Prodotto non valido';
    end if;

    begin
      v_quantita := (v_riga->>'quantita')::numeric;
    exception
      when others then
        raise exception 'Quantità non valida';
    end;

    if v_quantita is null or v_quantita <= 0 then
      raise exception 'Quantità non valida';
    end if;


    -- PREZZO E DATI PRODOTTO SEMPRE DAL DATABASE
    select
      id,
      nome,
      prezzo,
      unita
    into v_prodotto
    from public.prodotti
    where id = (v_riga->>'prodotto_id')::uuid
      and azienda_id = v_azienda_id
      and disponibile = true;

    if not found then
      raise exception 'Prodotto non disponibile';
    end if;


    v_subtotale :=
      round((v_prodotto.prezzo * v_quantita)::numeric, 2);

    v_totale := v_totale + v_subtotale;


    insert into public.righe_ordine (
      ordine_id,
      prodotto_id,
      nome_prodotto,
      quantita,
      unita,
      prezzo_unitario,
      subtotale,
      confezionamento,
      grammatura_confezione_grammi,
      numero_confezioni,
      preparazione,
      note
    )
    values (
      v_ordine_id,
      v_prodotto.id,
      v_prodotto.nome,
      v_quantita,
      v_prodotto.unita,
      v_prodotto.prezzo,
      v_subtotale,

      case
        when v_prodotto.unita::text = 'box'
        then null
        when nullif(v_riga->>'confezionamento', '') is not null
        then (v_riga->>'confezionamento')::tipo_confezionamento
        else null
      end,

      case
        when nullif(v_riga->>'grammatura_confezione_grammi', '') is not null
        then (v_riga->>'grammatura_confezione_grammi')::integer
        else null
      end,

      case
        when nullif(v_riga->>'numero_confezioni', '') is not null
        then (v_riga->>'numero_confezioni')::integer
        else null
      end,

      nullif(v_riga->>'preparazione', ''),
      nullif(v_riga->>'note', '')
    );

  end loop;


  -- AGGIORNA IL TOTALE CALCOLATO DAL DATABASE
  update public.ordini
  set
    totale = v_totale,
    updated_at = now()
  where id = v_ordine_id;


  IF nullif(trim(p_codice_referral),'') IS NOT NULL THEN
    INSERT INTO public.ma_referral_ordini(ordine_id,azienda_id,codice_id,codice,partner_id,percentuale)
    VALUES(v_ordine_id,v_azienda_id,v_ref.id,v_ref.codice,v_ref.partner_id,v_ref.percentuale);
  END IF;
  return jsonb_build_object(
    'success', true,
    'ordine_id', v_ordine_id,
    'numero_ordine', v_numero_ordine,
    'totale', v_totale
  );

end;
$function$
;

DO $grants$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname LIKE 'ma_referral_%' OR p.proname='crea_ordine_pubblico_referral') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
  IF f.proname IN ('ma_referral_verifica','crea_ordine_pubblico_referral') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated',f.signature);
  ELSIF f.proname NOT IN ('ma_referral_stato_guard','ma_referral_admin') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);
  END IF;
 END LOOP;
END $grants$;
NOTIFY pgrst, 'reload schema';
COMMIT;
