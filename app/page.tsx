"use client";

import { useEffect, useState, useRef, useId } from "react";
import { supabase } from "@/lib/supabase";

const WHATSAPP_NUMBER = "393513912335";

type Product = {
  id: string;
  category: string;
  name: string;
  price: string;
  image: string;
  description?: string;
  ingredients?: string;
  allergens?: string;
  fixedQuantity?: string;
  items?: string[];
  unit: string;
};

type CatalogRow = {
  id: string;
  nome: string;
  descrizione: string | null;
  prezzo: number | string;
  unita: string;
  immagine_url: string | null;
  categoria: string;
  categoria_ordinamento: number | null;
  ordinamento: number | null;
  ingredienti?: string | string[] | null;
  allergeni?: string | string[] | null;
};

type CartItem = {
  productId: string;
  name: string;
  quantity: string;
  price: string;
  unit: string;
  packaging?: "carta" | "sottovuoto" | "vaschetta" | "altro";
  packageWeightGrams?: number;
  preparation?: string;
};

const quantityOptions = [
  { value: "250 g", label: "250 g — circa 1-2 porzioni" },
  { value: "500 g", label: "500 g — circa 2-3 porzioni" },
  { value: "750 g", label: "750 g — circa 3-4 porzioni" },
  { value: "1 kg", label: "1 kg — circa 4-5 porzioni" },
  { value: "1,5 kg", label: "1,5 kg — circa 6-8 porzioni" },
  { value: "2 kg", label: "2 kg — circa 8-10 porzioni" },
  {
    value: "Quantità personalizzata nelle note",
    label: "Quantità personalizzata — scrivila nelle note",
  },
];

const packagingOptions = [
  { value: "carta", label: "Carta" },
  { value: "sottovuoto", label: "Sottovuoto" },
  { value: "vaschetta", label: "Vaschetta" },
  { value: "altro", label: "Altro" },
] as const;


function formatCatalogPrice(
  price: number | string,
  unit: string
) {
  const value = Number(price);

  if (!Number.isFinite(value)) {
    return "Prezzo da confermare";
  }

  const formatted = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);

  if (unit === "kg") {
    return `${formatted}/kg`;
  }

  return formatted;
}

function getFixedQuantity(unit: string) {
  if (unit === "box") return "1 box";
  if (unit === "pezzo") return "1 pezzo";
  if (unit === "confezione") return "1 confezione";

  return undefined;
}

function parsePriceValue(price: string) {
  const match = price.match(/([0-9][0-9.\s]*[.,]?[0-9]*)/);

  if (!match) return null;

  const normalized = match[1]
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

function parseUnitPrice(price: string) {
  if (!price.includes("/kg")) return null;
  return parsePriceValue(price);
}

function parseFixedPrice(price: string) {
  if (price.includes("/kg")) return null;
  return parsePriceValue(price);
}

function quantityToKg(quantity: string) {
  if (quantity.includes("personalizzata")) return null;

  if (quantity.endsWith(" g")) {
    return Number(quantity.replace(" g", "")) / 1000;
  }

  if (quantity.endsWith(" kg")) {
    return Number(
      quantity
        .replace(" kg", "")
        .replace(",", ".")
    );
  }

  return null;
}

function estimateItemTotal(item: CartItem) {
  const fixedPrice = parseFixedPrice(item.price);

  if (fixedPrice !== null) {
    return fixedPrice;
  }

  const unitPrice = parseUnitPrice(item.price);
  const weightKg = quantityToKg(item.quantity);

  if (unitPrice === null || weightKg === null) {
    return null;
  }

  return unitPrice * weightKg;
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function quantityToOrderNumber(quantity: string) {
  if (quantity === "1 box") return 1;
  if (quantity === "1 pezzo") return 1;
  if (quantity === "1 confezione") return 1;

  const kg = quantityToKg(quantity);

  if (kg !== null) {
    return kg;
  }

  return null;
}

function quantityToGrams(quantity: string) {
  const kg = quantityToKg(quantity);

  if (kg === null) return null;

  return Math.round(kg * 1000);
}

function calculatePackageCount(
  quantity: string,
  packageWeightGrams?: number
) {
  if (!packageWeightGrams || packageWeightGrams <= 0) {
    return null;
  }

  const totalGrams = quantityToGrams(quantity);

  if (totalGrams === null) {
    return null;
  }

  return Math.max(
    1,
    Math.round(totalGrams / packageWeightGrams)
  );
}

function catalogText(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value.trim() || undefined : undefined;
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it").replace(/[^a-z0-9]+/g, " ").trim();
}

function productMatchesSearch(product: Product, query: string) {
  const name = normalizeSearch(product.name);
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every((word) => name.includes(word));
}

function chooseFeaturedProducts(products: Product[]) {
  const text = (p: Product) => normalizeSearch(`${p.category} ${p.name}`);
  const box = (p: Product) => /\bbox\b/.test(text(p));
  const ready = (p: Product) => !box(p) && /pront[oi]|preparat|impanat|involtin|polpett|valdostan|spiedin|marinat/.test(text(p));
  const groups = [
    { label: "Manzo", matches: (p: Product) => !box(p) && !ready(p) && /manzo|bovino|scottona|tagliata|costata|fiorentina/.test(text(p)), preferred: /tagliata|scamone/ },
    { label: "Pollo", matches: (p: Product) => !box(p) && !ready(p) && /pollo/.test(text(p)), preferred: /petto/ },
    { label: "Pronto a cuocere", matches: ready, preferred: /involtin|polpett/ },
    { label: "Box", matches: box, preferred: /famiglia/ },
  ];
  const used = new Set<string>();
  return groups.flatMap((group) => {
    const candidates = products.filter((p) => !used.has(p.id) && group.matches(p));
    const product = candidates.find((p) => group.preferred.test(normalizeSearch(p.name))) || candidates[0];
    if (!product) return [];
    used.add(product.id);
    return [{ label: group.label, product }];
  });
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] =
    useState(true);
  const [catalogError, setCatalogError] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("Tutti");

  const [searchQuery, setSearchQuery] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [customerName, setCustomerName] =
    useState("");

  const [phone, setPhone] = useState("");

  const [deliveryMode, setDeliveryMode] =
    useState("Ritiro in sede");

  const [deliveryAddress, setDeliveryAddress] =
    useState("");

  const [deliveryCity, setDeliveryCity] =
    useState("");

  const [deliveryCap, setDeliveryCap] =
    useState("");

  const deliveryVerificationRun = useRef(0);

  const [deliveryVerificationStatus, setDeliveryVerificationStatus] =
    useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const [deliveryVerificationMessage, setDeliveryVerificationMessage] =
    useState("");

  const [deliveryDistanceKm, setDeliveryDistanceKm] =
    useState<number | null>(null);

  const [deliveryRadiusKm, setDeliveryRadiusKm] =
    useState<number | null>(null);

  const [deliveryDate, setDeliveryDate] =
    useState("");

  const [deliveryTime, setDeliveryTime] =
    useState("");

  const [notes, setNotes] = useState("");

  const [privacyAccepted, setPrivacyAccepted] =
    useState(false);

  const [allergensAccepted, setAllergensAccepted] =
    useState(false);

  const [showAllergensInfo, setShowAllergensInfo] =
    useState(false);

  const [showPrivacyInfo, setShowPrivacyInfo] =
    useState(false);

  const [installPrompt, setInstallPrompt] =
    useState<any>(null);

  const [showInstallBanner, setShowInstallBanner] =
    useState(false);

  const [orderSending, setOrderSending] =
    useState(false);

  useEffect(() => {
    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");

      const { data, error } = await supabase
        .from("catalogo_pubblico")
        .select("*")
        .order("categoria_ordinamento", {
          ascending: true,
        })
        .order("ordinamento", {
          ascending: true,
        })
        .order("nome", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Errore caricamento catalogo:",
          error
        );

        setCatalogError(
          "Non è stato possibile caricare il catalogo."
        );

        setCatalogLoading(false);
        return;
      }

      const rows = (data ?? []) as CatalogRow[];

      const mappedProducts: Product[] = rows.map((row) => ({
        id: row.id,
        category: row.categoria,
          name: row.nome,
          price: formatCatalogPrice(
            row.prezzo,
            row.unita
          ),
          image:
            row.immagine_url ||
            "/images/logo.png",
          description:
            row.descrizione || undefined,
          fixedQuantity: getFixedQuantity(
            row.unita
          ),
          unit: row.unita,
          ingredients: catalogText(row.ingredienti),
          allergens: catalogText(row.allergeni),
        }));

      setProducts(mappedProducts);
      setCatalogLoading(false);
    }

    loadCatalog();
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handler
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handler
      );
    };
  }, []);

  const categories = [
    "Tutti",
    ...Array.from(
      new Set(
        products.map(
          (product) => product.category
        )
      )
    ),
  ];

  const filteredProducts = products.filter((product) =>
    (selectedCategory === "Tutti" || product.category === selectedCategory) &&
    productMatchesSearch(product, searchQuery)
  );
  const featuredProducts = chooseFeaturedProducts(products);

  function addToCart(item: CartItem) {
    setCart((current) => [...current, item]);
  }

  function removeFromCart(
    indexToRemove: number
  ) {
    setCart(
      cart.filter(
        (_, index) => index !== indexToRemove
      )
    );
  }

  const estimatedTotal = cart.reduce(
    (total, item) => {
      const itemTotal =
        estimateItemTotal(item);

      return total + (itemTotal ?? 0);
    },
    0
  );

  const hasUnpricedItems = cart.some(
    (item) =>
      estimateItemTotal(item) === null
  );

  function contactButcher() {
    const message =
      "Ciao! Avrei bisogno di un consiglio per scegliere quantità, taglio o preparazione del mio ordine.";

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`;

    window.open(url, "_blank");
  }

  async function handleInstall() {
    if (!installPrompt) return;

    installPrompt.prompt();

    const result =
      await installPrompt.userChoice;

    if (result.outcome === "accepted") {
      setShowInstallBanner(false);
    }
  }

  function invalidateDeliveryVerification() {
    deliveryVerificationRun.current += 1;
    setDeliveryVerificationStatus("idle");
    setDeliveryVerificationMessage("");
    setDeliveryDistanceKm(null);
    setDeliveryRadiusKm(null);
  }

  async function verifyDeliveryAddress() {
    const run = ++deliveryVerificationRun.current;
    const street = deliveryAddress.trim();
    const city = deliveryCity.trim();
    const postalcode = deliveryCap.trim();

    if (!street || !city || !postalcode) {
      setDeliveryVerificationStatus("invalid");
      setDeliveryVerificationMessage(
        "Inserisci via e numero civico, città e CAP."
      );
      return;
    }

    setDeliveryVerificationStatus("checking");
    setDeliveryVerificationMessage("");
    setDeliveryDistanceKm(null);
    setDeliveryRadiusKm(null);

    try {
      const params = new URLSearchParams({
        street,
        city,
        postalcode,
      });

      const response = await fetch(
        `/api/geocode?${params.toString()}`
      );

      const geocodeResult = await response.json();
      if (run !== deliveryVerificationRun.current) return;

      if (!response.ok || !geocodeResult?.success) {
        setDeliveryVerificationStatus("invalid");
        setDeliveryVerificationMessage(
          geocodeResult?.message ||
            "Non è stato possibile verificare l'indirizzo."
        );
        return;
      }

      const { data, error } = await supabase.rpc(
        "verifica_consegna_pubblica",
        {
          p_latitudine: geocodeResult.latitude,
          p_longitudine: geocodeResult.longitude,
        }
      );

      if (run !== deliveryVerificationRun.current) return;
      if (error) {
        console.error(
          "Errore verifica raggio consegna:",
          error
        );
        setDeliveryVerificationStatus("invalid");
        setDeliveryVerificationMessage(
          "Non è stato possibile verificare la zona di consegna."
        );
        return;
      }

      const result =
        typeof data === "string"
          ? JSON.parse(data)
          : data;

      if (!result?.success) {
        setDeliveryVerificationStatus("invalid");
        setDeliveryVerificationMessage(
          result?.message ||
            "Configurazione consegne non disponibile."
        );
        return;
      }

      const distanza = Number(result.distanza_km);
      const raggio = Number(result.raggio_km);

      setDeliveryDistanceKm(
        Number.isFinite(distanza) ? distanza : null
      );
      setDeliveryRadiusKm(
        Number.isFinite(raggio) ? raggio : null
      );

      if (result.consentita) {
        setDeliveryVerificationStatus("valid");
        setDeliveryVerificationMessage(
          "Indirizzo disponibile per la consegna."
        );
      } else {
        setDeliveryVerificationStatus("invalid");
        setDeliveryVerificationMessage(
          "L'indirizzo si trova fuori dalla nostra zona di consegna. Puoi scegliere il ritiro in sede."
        );
      }
    } catch (error) {
      if (run !== deliveryVerificationRun.current) return;
      console.error(
        "Errore durante la verifica dell'indirizzo:",
        error
      );
      setDeliveryVerificationStatus("invalid");
      setDeliveryVerificationMessage(
        "Si è verificato un errore durante la verifica dell'indirizzo."
      );
    }
  }

  async function sendOrder() {
    if (
      !customerName.trim() ||
      !phone.trim() ||
      cart.length === 0
    ) {
      alert(
        "Inserisci nome, telefono e almeno un prodotto nel carrello."
      );
      return;
    }

    if (deliveryMode === "Consegna") {
      if (
        !deliveryAddress.trim() ||
        !deliveryCity.trim() ||
        !deliveryCap.trim()
      ) {
        alert(
          "Inserisci via e numero civico, città e CAP per la consegna."
        );
        return;
      }

      if (deliveryVerificationStatus !== "valid") {
        alert(
          "Verifica prima l'indirizzo di consegna."
        );
        return;
      }
    }

    if (!deliveryDate) {
      alert(
        deliveryMode === "Consegna"
          ? "Seleziona la data di consegna."
          : "Seleziona la data di ritiro."
      );
      return;
    }

    if (!deliveryTime) {
      alert(
        deliveryMode === "Consegna"
          ? "Seleziona l’orario di consegna."
          : "Seleziona l’orario di ritiro."
      );
      return;
    }

    if (
      !privacyAccepted ||
      !allergensAccepted
    ) {
      alert(
        "Per inviare l’ordine devi accettare privacy e informativa allergeni."
      );
      return;
    }

    const righe = cart.map((item) => ({
      prodotto_id: item.productId,
      quantita: quantityToOrderNumber(item.quantity),
      confezionamento:
        item.unit === "kg" ? item.packaging || null : null,
      grammatura_confezione_grammi:
        item.unit === "kg" ? item.packageWeightGrams || null : null,
      numero_confezioni:
        item.unit === "kg"
          ? calculatePackageCount(
              item.quantity,
              item.packageWeightGrams
            )
          : null,
      preparazione: item.preparation || null,
      note: null,
    }));

    if (
      righe.some(
        (riga) =>
          riga.quantita === null ||
          riga.quantita <= 0
      )
    ) {
      alert(
        "Per le quantità personalizzate scrivi prima al macellaio oppure scegli una quantità precisa dal menu."
      );
      return;
    }

    const deliveryDetails =
      deliveryMode === "Consegna"
        ? `Consegna — ${deliveryAddress}, ${deliveryCap} ${deliveryCity} — ${deliveryDate} alle ${deliveryTime}`
        : `Ritiro in sede — Via Roma 15, Castellanza — ${deliveryDate} alle ${deliveryTime}`;

    const message = `
NUOVO ORDINE - MACELLERIA ARTIGIANA

Nome: ${customerName}
Telefono: ${phone}
Modalità: ${deliveryDetails}

Prodotti:
${cart
  .map((item) => {
    const itemTotal = estimateItemTotal(item);
    const packagingDetails =
      item.unit === "kg" && item.packaging
        ? ` — ${item.packaging}${
            item.packageWeightGrams
              ? ` — ${calculatePackageCount(
                  item.quantity,
                  item.packageWeightGrams
                ) || 1} conf. da circa ${item.packageWeightGrams} g`
              : ""
          }`
        : "";

    return `- ${item.name} — ${item.quantity} — ${item.price}${packagingDetails}${
      itemTotal !== null
        ? ` — stima ${formatEuro(itemTotal)}`
        : ""
    }${item.preparation ? `\n  Preparazione: ${item.preparation}` : ""}`;
  })
  .join("\n")}

Totale indicativo: ${formatEuro(estimatedTotal)}${
      hasUnpricedItems
        ? " + eventuali prodotti da confermare"
        : ""
    }

Note:
${notes}

Cliente informato su privacy e allergeni.
Il peso finale può variare leggermente in base al taglio reale.
`;

    const whatsappWindow = window.open(
      "about:blank",
      "_blank"
    );

    setOrderSending(true);

    try {
      const { data, error } = await supabase.rpc(
        "crea_ordine_pubblico",
        {
          p_nome: customerName.trim(),
          p_cognome: "",
          p_telefono: phone.trim(),
          p_email: "",
          p_modalita:
            deliveryMode === "Consegna"
              ? "consegna"
              : "ritiro",
          p_indirizzo:
            deliveryMode === "Consegna"
              ? deliveryAddress.trim()
              : null,
          p_citta:
            deliveryMode === "Consegna"
              ? deliveryCity.trim()
              : null,
          p_cap:
            deliveryMode === "Consegna"
              ? deliveryCap.trim()
              : null,
          p_data_consegna: deliveryDate,
          p_ora_consegna: deliveryTime,
          p_note: notes.trim() || null,
          p_righe: righe,
        }
      );

      if (error) {
        console.error(
          "Errore creazione ordine MA Manager:",
          error
        );
        whatsappWindow?.close();
        alert(
          "Non è stato possibile registrare l’ordine. Riprova tra poco."
        );
        return;
      }

      const result =
        typeof data === "string"
          ? JSON.parse(data)
          : data;

      if (!result?.success) {
        console.error(
          "Risposta ordine non valida:",
          result
        );
        whatsappWindow?.close();
        alert(
          "L’ordine non è stato registrato correttamente. Riprova."
        );
        return;
      }

      console.log(
        "Ordine registrato in MA Manager:",
        result
      );

      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        message
      )}`;

      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }

      setCart([]);
      setNotes("");
      setDeliveryDate("");
      setDeliveryTime("");
      setDeliveryAddress("");
      setDeliveryCity("");
      setDeliveryCap("");
      invalidateDeliveryVerification();
    } catch (error) {
      console.error(
        "Errore durante l’invio ordine:",
        error
      );
      whatsappWindow?.close();
      alert(
        "Si è verificato un errore durante l’invio dell’ordine."
      );
    } finally {
      setOrderSending(false);
    }
  }

  return (
    <main
      className="min-h-screen bg-neutral-950 text-white"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.82)), url('/images/sfondo-macelleria.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
      }}
    >
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-white/10 bg-black/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">
                Installa Macelleria Artigiana
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Aggiungi l’app alla schermata Home
                per un accesso più veloce.
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() =>
                  setShowInstallBanner(false)
                }
                className="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white"
              >
                Più tardi
              </button>

              <button
                onClick={handleInstall}
                className="rounded-full bg-red-700 px-4 py-2 text-xs font-bold text-white"
              >
                Installa
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="bg-black/20 px-4 pb-10 pt-5 sm:px-6 md:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between gap-4">
            <a href="#" aria-label="Macelleria Artigiana, inizio pagina" className="flex items-center gap-3">
              <img src="/images/logo.png" alt="" className="h-14 w-14 object-contain md:h-20 md:w-20" />
              <span className="text-sm font-bold uppercase tracking-wider md:text-base">Macelleria Artigiana</span>
            </a>
            <a href="#carrello" className="shrink-0 rounded-full border border-white/20 px-4 py-3 text-sm">Carrello ({cart.length})</a>
          </div>
          <div className="my-6 max-w-3xl md:my-8">
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">Non vendiamo semplicemente carne.</h1>
            <p className="mt-3 text-base text-neutral-200 md:text-xl">Ci prendiamo cura di ciò che porterai sulla tua tavola.</p>
          </div>
          <form role="search" onSubmit={(event) => {event.preventDefault(); setSelectedCategory("Tutti"); document.getElementById("catalogo")?.scrollIntoView({behavior: "smooth"});}} className="mb-6 flex max-w-2xl gap-2">
            <label htmlFor="home-search" className="sr-only">Cerca un prodotto per nome</label>
            <input id="home-search" type="search" value={searchQuery} onChange={(event) => {setSearchQuery(event.target.value); setSelectedCategory("Tutti");}} placeholder="Cerca un prodotto, es. pollo o tagliata" className="min-w-0 flex-1 rounded-full border border-white/20 bg-neutral-900 px-4 py-3 text-sm text-white" />
            <button type="submit" className="rounded-full bg-red-700 px-5 py-3 text-sm font-bold hover:bg-red-800">Cerca</button>
          </form>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold">La nostra vetrina</h2>
            <a href="#catalogo" className="py-2 text-sm font-bold text-red-400 underline">Tutti i prodotti</a>
          </div>
          {catalogLoading ? <p role="status" className="py-8 text-neutral-300">Caricamento prodotti…</p> : catalogError ? <p className="py-6 text-neutral-300">{catalogError}</p> : featuredProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
              {featuredProducts.map(({label, product}) => <div key={product.id} className="flex flex-col gap-2"><p className="text-xs font-bold uppercase tracking-wider text-red-400">{label}</p><ProductCard product={product} onAdd={addToCart} /></div>)}
            </div>
          ) : <p className="py-6 text-neutral-300">La vetrina sarà disponibile con i prodotti del catalogo.</p>}
        </div>
      </section>

      <section
        id="catalogo"
        className="bg-black/35 px-4 py-16 backdrop-blur-[1px]"
      >
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">
            Catalogo prodotti
          </h2>

          {catalogLoading && (
            <div className="mt-10 text-center text-neutral-300">
              Caricamento catalogo...
            </div>
          )}

          {catalogError && (
            <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-500/30 bg-red-950/40 p-5 text-center text-red-200">
              {catalogError}
            </div>
          )}

          {!catalogLoading &&
            !catalogError && (
              <>
                <div role="search" className="mx-auto mt-6 max-w-xl">
                  <label htmlFor="catalog-search" className="mb-2 block text-sm font-bold">Cerca nel catalogo</label>
                  <div className="flex gap-2"><input id="catalog-search" type="search" value={searchQuery} onChange={(event) => {setSearchQuery(event.target.value); setSelectedCategory("Tutti");}} placeholder="Scrivi il nome del prodotto" className="min-w-0 flex-1 rounded-full border border-white/20 bg-neutral-900 px-4 py-3 text-white" />
                  {searchQuery && <button type="button" onClick={() => setSearchQuery("")} className="rounded-full bg-white/10 px-4 text-sm">Cancella</button>}</div>
                  <p aria-live="polite" className="mt-2 text-sm text-neutral-400">{filteredProducts.length} {filteredProducts.length === 1 ? "prodotto trovato" : "prodotti trovati"}</p>
                </div>
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {categories.map(
                    (category) => (
                      <button
                        key={category}
                        onClick={() =>
                          setSelectedCategory(
                            category
                          )
                        }
                        className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${
                          selectedCategory ===
                          category
                            ? "bg-red-700 text-white"
                            : "bg-white/10 text-white hover:bg-white/20"
                        }`}
                      >
                        {category}
                      </button>
                    )
                  )}
                </div>

                {filteredProducts.length ===
                0 ? (
                  <p className="mt-10 text-center text-neutral-400">
                    Nessun prodotto trovato. Prova un altro nome o seleziona “Tutti”.
                  </p>
                ) : (
                  <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
                    {filteredProducts.map(
                      (product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          onAdd={addToCart}
                        />
                      )
                    )}
                  </div>
                )}
              </>
            )}
        </div>
      </section>

      <section className="bg-white px-6 py-20 text-neutral-950">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-red-700">
            Chi siamo
          </p>

          <h2 className="mt-4 text-3xl font-bold md:text-5xl">
            Una macelleria artigiana
            pensata per chi vuole mangiare
            bene.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-neutral-700">
            Macelleria Artigiana nasce
            dall’esperienza nel lavoro
            della carne, dalla cura per i
            dettagli e dal desiderio di
            offrire un servizio più vicino
            alle esigenze reali delle
            persone. Non siamo solo una
            macelleria: siamo un laboratorio
            su misura dove qualità,
            tradizione e praticità si
            incontrano.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-neutral-700">
            Prepariamo prodotti selezionati,
            porzionati con attenzione e
            pensati per famiglie, sportivi
            e clienti che vogliono
            organizzare meglio la propria
            alimentazione. Puoi scegliere
            prodotti al kg, box già studiati
            o ordini personalizzati.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-neutral-700">
            Puoi ritirare in sede in Via
            Roma 15 a Castellanza oppure
            concordare la consegna nel luogo
            e nell’orario più comodi per te.
          </p>
        </div>
      </section>

      <section className="bg-white px-6 py-20 text-neutral-950">
        <div className="mx-auto max-w-3xl">
          <h2 id="carrello" className="scroll-mt-6 text-3xl font-bold">
            Checkout ordine
          </h2>

          {cart.length === 0 ? (
            <p className="mt-4 text-neutral-600">
              Il carrello è ancora vuoto.
            </p>
          ) : (
            <>
              <div className="mt-6 space-y-3">
                {cart.map(
                  (item, index) => {
                    const itemTotal =
                      estimateItemTotal(
                        item
                      );

                    return (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-100 p-4"
                      >
                        <div>
                          <p className="font-bold">
                            {item.name}
                          </p>

                          <p className="mt-1 text-sm text-neutral-600">
                            {item.quantity} —{" "}
                            {item.price}
                            {item.unit === "kg" &&
                              item.packaging &&
                              ` — ${item.packaging}`}
                            {item.unit === "kg" &&
                              item.packageWeightGrams &&
                              ` — ${
                                calculatePackageCount(
                                  item.quantity,
                                  item.packageWeightGrams
                                ) || 1
                              } conf. da circa ${
                                item.packageWeightGrams
                              } g`}
                            {itemTotal !==
                              null &&
                              ` — circa ${formatEuro(
                                itemTotal
                              )}`}
                          </p>
                          {item.preparation && <p className="mt-2 whitespace-pre-line text-sm text-neutral-600">Preparazione: {item.preparation}</p>}
                        </div>

                        <button
                          onClick={() =>
                            removeFromCart(
                              index
                            )
                          }
                          className="shrink-0 rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
                        >
                          Rimuovi
                        </button>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="mt-6 rounded-3xl bg-neutral-950 p-6 text-white shadow-xl">
                <p className="text-sm font-bold uppercase tracking-wider text-neutral-400">
                  Totale provvisorio
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {formatEuro(
                    estimatedTotal
                  )}
                </p>

                <p className="mt-2 text-sm text-neutral-400">
                  {hasUnpricedItems
                    ? "Il totale non comprende eventuali prodotti con prezzo da confermare."
                    : "È una stima: il totale finale può variare leggermente in base al peso reale del prodotto preparato."}
                </p>
              </div>
            </>
          )}

          <div className="mt-8 rounded-3xl border border-green-200 bg-green-50 p-5">
            <p className="font-bold text-neutral-950">
              Hai un dubbio prima di
              ordinare?
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-700">
              Scrivimi direttamente: ti
              aiuto a scegliere quantità,
              taglio e preparazione giusti
              per te.
            </p>

            <button
              onClick={contactButcher}
              className="mt-4 w-full rounded-full bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700"
            >
              Parla con il macellaio su
              WhatsApp
            </button>
          </div>

          <div className="mt-10 grid gap-4">
            <input
              value={customerName}
              onChange={(e) =>
                setCustomerName(
                  e.target.value
                )
              }
              placeholder="Nome e cognome"
              className="rounded-2xl border p-4"
            />

            <input
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
              placeholder="Telefono"
              className="rounded-2xl border p-4"
            />

            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-wider text-neutral-700">
                Come vuoi ricevere il tuo
                ordine?
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryMode("Ritiro in sede");
                    invalidateDeliveryVerification();
                  }}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    deliveryMode ===
                    "Ritiro in sede"
                      ? "border-red-700 bg-red-50"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  }`}
                >
                  <span className="block text-lg font-bold">
                    📍 Ritiro in sede
                  </span>

                  <span className="mt-1 block text-sm text-neutral-600">
                    Via Roma 15,
                    Castellanza
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDeliveryMode("Consegna");
                    invalidateDeliveryVerification();
                  }}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    deliveryMode ===
                    "Consegna"
                      ? "border-red-700 bg-red-50"
                      : "border-neutral-200 bg-white hover:border-neutral-400"
                  }`}
                >
                  <span className="block text-lg font-bold">
                    🚚 Consegna
                  </span>

                  <span className="mt-1 block text-sm text-neutral-600">
                    Da concordare con il
                    macellaio
                  </span>
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-neutral-700">
                  {deliveryMode === "Consegna"
                    ? "Data consegna"
                    : "Data ritiro"}
                </label>

                <input
                  type="date"
                  value={deliveryDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) =>
                    setDeliveryDate(e.target.value)
                  }
                  className="w-full rounded-2xl border p-4"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold uppercase tracking-wider text-neutral-700">
                  {deliveryMode === "Consegna"
                    ? "Ora consegna"
                    : "Ora ritiro"}
                </label>

                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) =>
                    setDeliveryTime(e.target.value)
                  }
                  className="w-full rounded-2xl border p-4"
                />
              </div>
            </div>

            {deliveryMode === "Consegna" && (
              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-5">
                <p className="text-sm font-bold uppercase tracking-wider text-neutral-700">
                  Indirizzo di consegna
                </p>

                <p className="mt-1 text-sm text-neutral-600">
                  Inserisci l'indirizzo completo e verifica che rientri nella nostra zona di consegna.
                </p>

                <div className="mt-4 grid gap-3">
                  <input
                    value={deliveryAddress}
                    onChange={(e) => {
                      setDeliveryAddress(e.target.value);
                      invalidateDeliveryVerification();
                    }}
                    placeholder="Via e numero civico"
                    className="rounded-2xl border bg-white p-4"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={deliveryCity}
                      onChange={(e) => {
                        setDeliveryCity(e.target.value);
                        invalidateDeliveryVerification();
                      }}
                      placeholder="Città"
                      className="rounded-2xl border bg-white p-4"
                    />

                    <input
                      value={deliveryCap}
                      onChange={(e) => {
                        setDeliveryCap(e.target.value);
                        invalidateDeliveryVerification();
                      }}
                      inputMode="numeric"
                      placeholder="CAP"
                      className="rounded-2xl border bg-white p-4"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={verifyDeliveryAddress}
                    disabled={deliveryVerificationStatus === "checking"}
                    className="rounded-full bg-neutral-950 px-6 py-3 font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deliveryVerificationStatus === "checking"
                      ? "Verifica in corso..."
                      : "Verifica indirizzo"}
                  </button>

                  {deliveryVerificationStatus !== "idle" &&
                    deliveryVerificationStatus !== "checking" && (
                      <div
                        className={`rounded-2xl border p-4 text-sm ${
                          deliveryVerificationStatus === "valid"
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-200 bg-red-50 text-red-800"
                        }`}
                      >
                        <p className="font-bold">
                          {deliveryVerificationStatus === "valid"
                            ? "✓ Consegna disponibile"
                            : "✕ Consegna non disponibile"}
                        </p>

                        <p className="mt-1">
                          {deliveryVerificationMessage}
                        </p>

                        {deliveryDistanceKm !== null &&
                          deliveryRadiusKm !== null && (
                            <p className="mt-2 text-xs">
                              Distanza dalla sede:{" "}
                              <strong>
                                {deliveryDistanceKm.toFixed(2)} km
                              </strong>
                              {" "}— raggio massimo:{" "}
                              <strong>
                                {deliveryRadiusKm.toFixed(2)} km
                              </strong>
                            </p>
                          )}
                      </div>
                    )}
                </div>
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value)
              }
              placeholder="Note: taglio, sottovuoto, orario, allergeni..."
              className="min-h-32 rounded-2xl border p-4"
            />

            <div className="rounded-2xl bg-neutral-100 p-4 text-sm">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={
                    allergensAccepted
                  }
                  onChange={(e) =>
                    setAllergensAccepted(
                      e.target.checked
                    )
                  }
                  className="mt-1"
                />

                <div className="flex-1">
                  <span>
                    Ho letto l’informativa
                    allergeni.
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setShowAllergensInfo(
                        !showAllergensInfo
                      )
                    }
                    className="mt-2 block font-bold text-red-700 underline underline-offset-2"
                    aria-expanded={
                      showAllergensInfo
                    }
                  >
                    {showAllergensInfo
                      ? "Chiudi informativa"
                      : "Consulta l’informativa allergeni"}
                  </button>
                </div>
              </div>

              {showAllergensInfo && (
                <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 text-sm leading-6 text-neutral-700">
                  <h3 className="text-lg font-bold text-neutral-950">
                    Informativa allergeni
                  </h3>

                  <p className="mt-3">
                    Si comunica alla
                    clientela che nei nostri
                    prodotti possono essere
                    presenti alcuni
                    allergeni. Per qualsiasi
                    informazione specifica è
                    possibile consultare le
                    informazioni e gli
                    ingredienti riportati
                    nell’app o presso il
                    nostro negozio.
                  </p>

                  <p className="mt-3 font-semibold text-neutral-900">
                    Si raccomanda comunque
                    di segnalare sempre se
                    si soffre di particolari
                    allergie o intolleranze,
                    certe o anche solo
                    presunte, per avere
                    informazioni più
                    dettagliate a riguardo.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    Elenco degli allergeni
                    ai sensi del Reg. UE n.
                    1169/2011
                  </h4>

                  <ol className="mt-3 list-decimal space-y-3 pl-5">
                    <li>
                      Cereali contenenti
                      glutine (cioè grano,
                      segale, orzo, avena,
                      farro, kamut o i loro
                      ceppi ibridati) e
                      prodotti derivati,
                      tranne:
                      <div className="mt-2 pl-4">
                        a) sciroppi di
                        glucosio a base di
                        grano, incluso
                        destrosio, e prodotti
                        derivati, purché il
                        processo subito non
                        aumenti il livello di
                        allergenicità
                        valutato dall’EFSA
                        per il prodotto di
                        base dal quale sono
                        derivati;
                        <br />
                        b) maltodestrine a
                        base di grano e
                        prodotti derivati,
                        purché il processo
                        subito non aumenti
                        il livello di
                        allergenicità
                        valutato dall’EFSA
                        per il prodotto di
                        base dal quale sono
                        derivati;
                        <br />
                        c) sciroppi di
                        glucosio a base
                        d’orzo;
                        <br />
                        d) cereali utilizzati
                        per la fabbricazione
                        di distillati o di
                        alcol etilico di
                        origine agricola per
                        liquori ed altre
                        bevande alcoliche.
                      </div>
                    </li>

                    <li>
                      Crostacei e prodotti
                      derivati.
                    </li>

                    <li>
                      Uova e prodotti
                      derivati.
                    </li>

                    <li>
                      Pesce e prodotti
                      derivati, tranne:
                      <div className="mt-2 pl-4">
                        a) gelatina di pesce
                        utilizzata come
                        supporto per preparati
                        di vitamine o
                        carotenoidi;
                        <br />
                        b) gelatina o colla
                        di pesce utilizzata
                        come chiarificante
                        nella birra e nel
                        vino.
                      </div>
                    </li>

                    <li>
                      Arachidi e prodotti
                      derivati.
                    </li>

                    <li>
                      Soia e prodotti
                      derivati, tranne:
                      <div className="mt-2 pl-4">
                        a) olio e grasso di
                        soia raffinato e
                        prodotti derivati,
                        purché il processo
                        subito non aumenti
                        il livello di
                        allergenicità
                        valutato dall’EFSA
                        per il prodotto di
                        base dal quale sono
                        derivati;
                        <br />
                        b) tocoferoli misti
                        naturali (E306),
                        tocoferolo D-alfa
                        naturale, tocoferolo
                        acetato D-alfa
                        naturale, tocoferolo
                        succinato D-alfa
                        naturale a base di
                        soia;
                        <br />
                        c) oli vegetali
                        derivati da
                        fitosteroli e
                        fitosteroli esteri a
                        base di soia;
                        <br />
                        d) estere di stanolo
                        vegetale prodotto da
                        steroli di olio
                        vegetale a base di
                        soia.
                      </div>
                    </li>

                    <li>
                      Latte e prodotti
                      derivati, incluso
                      lattosio, tranne:
                      <div className="mt-2 pl-4">
                        a) siero di latte
                        utilizzato per la
                        fabbricazione di
                        distillati o di alcol
                        etilico di origine
                        agricola per liquori
                        ed altre bevande
                        alcoliche;
                        <br />
                        b) lattitolo.
                      </div>
                    </li>

                    <li>
                      Frutta a guscio, cioè
                      mandorle (Amygdalus
                      communis L.), nocciole
                      (Corylus avellana),
                      noci comuni (Juglans
                      regia), noci di
                      anacardi (Anacardium
                      occidentale), noci di
                      pecan (Carya
                      illinoiesis (Wangenh)
                      K. Koch), noci del
                      Brasile (Bertholletia
                      excelsa), pistacchi
                      (Pistacia vera), noci
                      del Queensland
                      (Macadamia ternifolia)
                      e prodotti derivati,
                      tranne frutta a guscio
                      utilizzata per la
                      fabbricazione di
                      distillati o di alcol
                      etilico di origine
                      agricola per liquori
                      ed altre bevande
                      alcoliche.
                    </li>

                    <li>
                      Sedano e prodotti
                      derivati.
                    </li>

                    <li>
                      Senape e prodotti
                      derivati.
                    </li>

                    <li>
                      Semi di sesamo e
                      prodotti derivati.
                    </li>

                    <li>
                      Anidride solforosa e
                      solfiti in
                      concentrazioni
                      superiori a 10 mg/Kg o
                      10 mg/l espressi come
                      SO2.
                    </li>

                    <li>
                      Lupini e prodotti
                      derivati.
                    </li>

                    <li>
                      Molluschi e prodotti
                      derivati.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-neutral-100 p-4 text-sm">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={
                    privacyAccepted
                  }
                  onChange={(e) =>
                    setPrivacyAccepted(
                      e.target.checked
                    )
                  }
                  className="mt-1"
                />

                <div className="flex-1">
                  <span>
                    Ho letto l’informativa
                    privacy.
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setShowPrivacyInfo(
                        !showPrivacyInfo
                      )
                    }
                    className="mt-2 block font-bold text-red-700 underline underline-offset-2"
                    aria-expanded={
                      showPrivacyInfo
                    }
                  >
                    {showPrivacyInfo
                      ? "Chiudi informativa"
                      : "Consulta l’informativa privacy"}
                  </button>
                </div>
              </div>

              {showPrivacyInfo && (
                <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 text-sm leading-6 text-neutral-700">
                  <h3 className="text-lg font-bold text-neutral-950">
                    Informativa sul
                    trattamento dei dati
                    personali
                  </h3>

                  <p className="mt-1 text-xs text-neutral-500">
                    Ai sensi dell’art. 13
                    del Regolamento (UE)
                    2016/679 (GDPR)
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    1. Titolare del
                    trattamento
                  </h4>

                  <p className="mt-2">
                    Il Titolare del
                    trattamento è{" "}
                    <strong>
                      Macelleria Artigiana
                    </strong>
                    , P. IVA 04157550122,
                    con sede in Via Roma 15,
                    Castellanza (VA),
                    contattabile
                    all’indirizzo
                    <strong>
                      {" "}
                      info@macelleriaartigiana.it
                    </strong>
                    .
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    2. Dati trattati
                  </h4>

                  <p className="mt-2">
                    Attraverso l’app possono
                    essere trattati i dati
                    forniti volontariamente
                    dal cliente: nome e
                    cognome, numero di
                    telefono, prodotti
                    ordinati, modalità di
                    ritiro o consegna,
                    eventuale indirizzo di
                    consegna e informazioni
                    inserite nel campo note.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    3. Finalità e base
                    giuridica
                  </h4>

                  <p className="mt-2">
                    I dati sono utilizzati
                    per ricevere, gestire e
                    preparare l’ordine,
                    contattare il cliente
                    quando necessario,
                    organizzare il ritiro o
                    la consegna e adempiere
                    agli eventuali obblighi
                    amministrativi, fiscali
                    e di legge. Il
                    trattamento necessario
                    alla gestione dell’ordine
                    si basa sull’esecuzione
                    di misure
                    precontrattuali adottate
                    su richiesta del cliente
                    e sull’esecuzione del
                    rapporto contrattuale;
                    gli eventuali
                    trattamenti richiesti
                    dalla legge si basano
                    sull’adempimento di
                    obblighi legali.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    4. Allergie e
                    intolleranze
                  </h4>

                  <p className="mt-2">
                    Qualora il cliente
                    comunichi volontariamente
                    informazioni relative ad
                    allergie, intolleranze o
                    altre esigenze connesse
                    alla salute, tali
                    informazioni saranno
                    utilizzate
                    esclusivamente per
                    fornire indicazioni e
                    gestire la specifica
                    richiesta del cliente.
                    L’invio volontario di
                    tali informazioni deve
                    avvenire solo quando
                    necessario al servizio
                    richiesto.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    5. Modalità di invio
                    dell’ordine
                  </h4>

                  <p className="mt-2">
                    Al termine della
                    compilazione l’app genera
                    un messaggio che il
                    cliente sceglie di
                    inviare tramite WhatsApp.
                    L’utilizzo di WhatsApp
                    comporta quindi anche il
                    trattamento dei dati da
                    parte del relativo
                    fornitore del servizio
                    secondo le proprie
                    condizioni e informative
                    privacy.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    6. Conferimento dei dati
                  </h4>

                  <p className="mt-2">
                    Il conferimento dei dati
                    necessari all’ordine è
                    indispensabile per poter
                    gestire la richiesta. In
                    mancanza di tali dati
                    non sarà possibile
                    inviare e gestire
                    correttamente l’ordine.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    7. Destinatari dei dati
                  </h4>

                  <p className="mt-2">
                    I dati possono essere
                    trattati dal Titolare e
                    da soggetti che
                    forniscono servizi
                    tecnici, amministrativi
                    o professionali
                    strettamente necessari
                    alla gestione
                    dell’attività, nei
                    limiti delle rispettive
                    funzioni e degli
                    obblighi di legge.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    8. Conservazione
                  </h4>

                  <p className="mt-2">
                    I dati sono conservati
                    per il tempo necessario
                    alla gestione dell’ordine
                    e delle eventuali
                    richieste collegate. I
                    dati che devono essere
                    conservati per obblighi
                    amministrativi,
                    contabili o fiscali
                    saranno mantenuti per i
                    periodi previsti dalla
                    normativa applicabile.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    9. Diritti
                    dell’interessato
                  </h4>

                  <p className="mt-2">
                    Nei casi previsti dal
                    GDPR, l’interessato può
                    chiedere l’accesso ai
                    propri dati personali,
                    la rettifica, la
                    cancellazione, la
                    limitazione del
                    trattamento, la
                    portabilità dei dati e
                    può opporsi al
                    trattamento. Le
                    richieste possono essere
                    inviate a
                    <strong>
                      {" "}
                      info@macelleriaartigiana.it
                    </strong>
                    . È inoltre possibile
                    proporre reclamo al
                    Garante per la
                    protezione dei dati
                    personali.
                  </p>

                  <h4 className="mt-5 font-bold text-neutral-950">
                    10. Aggiornamenti
                  </h4>

                  <p className="mt-2">
                    La presente informativa
                    potrà essere aggiornata
                    qualora cambino le
                    modalità di trattamento
                    dei dati o i servizi
                    utilizzati dall’app.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={sendOrder}
              disabled={orderSending}
              className="rounded-full bg-green-600 px-6 py-4 font-bold uppercase text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {orderSending
                ? "Registrazione ordine..."
                : "Invia ordine su WhatsApp"}
            </button>
          </div>
        </div>
      </section>

      <section
        id="contatti"
        className="bg-black/40 px-6 py-20 backdrop-blur-[1px]"
      >
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            Contatti
          </p>

          <h2 className="mt-4 text-center text-3xl font-bold md:text-5xl">
            Vieni a trovarci o contattaci
            per il tuo ordine.
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-white/5 p-6">
              <h3 className="text-xl font-bold">
                Macelleria Artigiana
              </h3>

              <p className="mt-4 text-neutral-300">
                Via Roma 15, Castellanza
                (VA)
              </p>

              <p className="mt-2 text-neutral-300">
                Telefono: +39 351 391 2335
              </p>

              <p className="mt-2 text-neutral-300">
                Email:
                info@macelleriaartigiana.it
              </p>
            </div>

            <div className="rounded-3xl bg-white/5 p-6">
              <h3 className="text-xl font-bold">
                Orari
              </h3>

              <p className="mt-4 text-neutral-300">
                Dal lunedì al sabato
              </p>

              <p className="mt-2 text-neutral-300">
                08:30 - 19:30
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-neutral-500">
        © Macelleria Artigiana — Via Roma
        15, Castellanza (VA) —
        info@macelleriaartigiana.it
      </footer>
    </main>
  );
}

function ProductCard({ product, onAdd }: { product: Product; onAdd: (item: CartItem) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const quantityId = useId();
  const packagingId = useId();
  const packageWeightId = useId();
  const preparationId = useId();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [quantity, setQuantity] = useState(product.fixedQuantity || "500 g");
  const [customWeight, setCustomWeight] = useState("");
  const [preparation, setPreparation] = useState("");
  const [packaging, setPackaging] = useState<NonNullable<CartItem["packaging"]>>("carta");
  const [packageWeightGrams, setPackageWeightGrams] = useState<number | "">(500);
  const isCustom = quantity.includes("personalizzata");
  const numericWeight = Number(customWeight.replace(",", "."));
  const validQuantity = !isCustom || (Number.isFinite(numericWeight) && numericWeight > 0);
  const selectedQuantity = isCustom ? `${numericWeight} kg` : quantity;
  const estimatedPrice = validQuantity ? estimateItemTotal({productId: product.id, name: product.name, quantity: selectedQuantity, price: product.price, unit: product.unit}) : null;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1800);
    return () => window.clearTimeout(timer);
  }, [added]);

  function openProduct() { dialog.current?.showModal(); setOpen(true); }
  function closeProduct() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  function handleImageError(event: React.SyntheticEvent<HTMLImageElement>) {
    if (!event.currentTarget.src.endsWith("/images/logo.png")) event.currentTarget.src = "/images/logo.png";
  }
  function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validQuantity) return;
    onAdd({
      productId: product.id, name: product.name, quantity: selectedQuantity,
      price: product.price, unit: product.unit,
      preparation: preparation.trim() || undefined,
      packaging: product.unit === "kg" ? packaging : undefined,
      packageWeightGrams: product.unit === "kg" && packageWeightGrams !== "" ? packageWeightGrams : undefined,
    });
    setAdded(true); closeProduct(); setPreparation("");
  }

  return <>
    <article className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80">
      <button type="button" tabIndex={-1} aria-label={`Apri ${product.name}`} onClick={openProduct} className="flex h-28 w-full items-center justify-center bg-neutral-900 p-2 md:h-40">
        <img src={product.image} alt={product.name} loading="lazy" onError={handleImageError} className="max-h-full max-w-full object-contain" />
      </button>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <h3 className="text-sm font-bold leading-5 md:text-base">{product.name}</h3>
        <p className="mb-3 mt-2 text-sm font-medium text-red-400">{product.price}</p>
        <button ref={trigger} type="button" aria-haspopup="dialog" aria-label={`Personalizza ${product.name}`} onClick={openProduct} className="mt-auto min-h-11 w-full rounded-full bg-red-700 px-2 py-3 text-xs font-bold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:text-sm"><span aria-live="polite">{added ? "Aggiunto ✓" : "Personalizza"}</span></button>
      </div>
    </article>
    <dialog ref={dialog} aria-labelledby={dialogTitleId} onCancel={(event) => {event.preventDefault(); closeProduct();}} onClose={() => setOpen(false)} onClick={(event) => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeProduct();
      }
    }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-xl overflow-y-auto rounded-3xl border border-white/15 bg-neutral-950 p-0 text-white shadow-2xl backdrop:bg-black/80">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-neutral-950 p-4">
        <h2 id={dialogTitleId} className="text-lg font-bold">{product.name}</h2>
        <button type="button" autoFocus onClick={closeProduct} className="min-h-11 shrink-0 rounded-full bg-white/10 px-4 text-sm" aria-label="Chiudi scheda prodotto">Chiudi</button>
      </div>
      <form onSubmit={handleAdd} className="space-y-5 p-4 md:p-6">
        <img src={product.image} alt={product.name} loading="lazy" onError={handleImageError} className="h-44 w-full rounded-xl bg-neutral-900 object-contain" />
        <div><p className="text-xs font-bold uppercase tracking-wider text-red-400">{product.category}</p><p className="mt-2 text-lg font-bold">{product.price}</p></div>
        {product.description && <section><h3 className="font-bold">Descrizione</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-neutral-300">{product.description}</p></section>}
        {product.items && <ul className="list-inside list-disc text-sm text-neutral-300">{product.items.map(item => <li key={item}>{item}</li>)}</ul>}
        <section className="rounded-2xl bg-white/5 p-4">
          <h3 className="font-bold">Ingredienti e allergeni</h3>
          {product.ingredients && <p className="mt-2 whitespace-pre-line text-sm text-neutral-300"><strong>Ingredienti: </strong>{product.ingredients}</p>}
          {product.allergens && <p className="mt-2 whitespace-pre-line text-sm text-neutral-300"><strong>Allergeni: </strong>{product.allergens}</p>}
          {(!product.ingredients || !product.allergens) && <p className="mt-2 text-sm leading-6 text-neutral-300">Consulta anche la descrizione. Per informazioni non indicate, chiedi conferma al macellaio prima di ordinare.</p>}
          <a href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Ciao, vorrei informazioni su ingredienti e allergeni di ${product.name}.`)}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block py-2 text-sm font-bold text-red-400 underline">Chiedi al macellaio</a>
        </section>
        <div>
          <label htmlFor={quantityId} className="mb-2 block text-sm font-bold">Scegli quantità</label>
          {product.fixedQuantity ? <p>{product.fixedQuantity}</p> : <select id={quantityId} value={quantity} onChange={event => setQuantity(event.target.value)} className="w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white">{quantityOptions.map(option => <option key={option.value} value={option.value}>{option.value.includes("personalizzata") ? "Altro peso — inserisci i kg" : option.label}</option>)}</select>}
          {isCustom && <label className="mt-4 block text-sm font-bold">Peso totale in kg<input type="number" required min="0.001" step="0.001" inputMode="decimal" value={customWeight} onChange={event => setCustomWeight(event.target.value)} placeholder="Es. 1,25" className="mt-2 w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-white" /></label>}
        </div>
        {product.unit === "kg" && <>
          <div><label htmlFor={packagingId} className="mb-2 block text-sm font-bold">Confezionamento</label><select id={packagingId} value={packaging} onChange={event => setPackaging(event.target.value as NonNullable<CartItem["packaging"]>)} className="w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white">{packagingOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div><label htmlFor={packageWeightId} className="mb-2 block text-sm font-bold">Peso desiderato per confezione</label><div className="flex items-center gap-2"><input id={packageWeightId} type="number" min={1} max={1000} step={1} value={packageWeightGrams} onFocus={event => event.currentTarget.select()} onChange={event => {const raw = event.target.value; setPackageWeightGrams(raw === "" ? "" : Number(raw));}} onBlur={() => {if (packageWeightGrams === "") setPackageWeightGrams(500);}} className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white" /><span className="text-sm text-neutral-300">g</span></div><p className="mt-2 text-xs leading-5 text-neutral-400">Il numero di confezioni viene calcolato in base alla quantità totale scelta.</p></div>
        </>}
        <div><label htmlFor={preparationId} className="mb-2 block text-sm font-bold">Taglio e richieste di preparazione</label><textarea id={preparationId} value={preparation} onChange={event => setPreparation(event.target.value)} maxLength={600} rows={3} placeholder="Es. fettine sottili, cubetti per spezzatino…" className="w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm" /><p className="mt-2 text-xs text-neutral-400">Le richieste saranno confermate dal macellaio.</p></div>
        <div><p aria-live="polite" className="text-lg font-bold">{estimatedPrice !== null ? `Totale indicativo: ${formatEuro(estimatedPrice)}` : "Importo da confermare"}</p><p className="mt-1 text-xs text-neutral-400">Il prezzo finale dipende dal peso effettivo e dalle richieste concordate.</p></div>
        <button type="submit" disabled={!validQuantity} className="w-full rounded-full bg-red-700 px-3 py-3 text-sm font-bold uppercase text-white hover:bg-red-800 disabled:opacity-40">Aggiungi al carrello</button>
      </form>
    </dialog>
  </>;
}
