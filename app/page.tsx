"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const WHATSAPP_NUMBER = "393513912335";

type Product = {
  id: string;
  category: string;
  name: string;
  price: string;
  image: string;
  description?: string;
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
};

type CartItem = {
  productId: string;
  name: string;
  quantity: string;
  price: string;
  unit: string;
  packaging?: "carta" | "sottovuoto" | "vaschetta" | "altro";
  packageWeightGrams?: number;
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

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] =
    useState(true);
  const [catalogError, setCatalogError] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState("Tutti");

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
        .select(
          `
            id,
            nome,
            descrizione,
            prezzo,
            unita,
            immagine_url,
            categoria,
            categoria_ordinamento,
            ordinamento
          `
        )
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

  const filteredProducts =
    selectedCategory === "Tutti"
      ? products
      : products.filter(
          (product) =>
            product.category === selectedCategory
        );

  function addToCart(item: CartItem) {
    setCart([...cart, item]);
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
    setDeliveryVerificationStatus("idle");
    setDeliveryVerificationMessage("");
    setDeliveryDistanceKm(null);
    setDeliveryRadiusKm(null);
  }

  async function verifyDeliveryAddress() {
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
      preparazione: null,
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
    }`;
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

      <section className="flex min-h-screen flex-col items-center justify-center bg-black/20 px-6 text-center">
        <img
          src="/images/logo.png"
          alt="Macelleria Artigiana"
          className="mb-8 h-32 w-32 rounded-full object-contain"
        />

        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-red-500">
          Macelleria Artigiana
        </p>

        <h1 className="max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
          Non vendiamo semplicemente carne.
        </h1>

        <p className="mt-6 max-w-2xl text-xl font-medium text-neutral-200">
          Ci prendiamo cura di ciò che
          porterai sulla tua tavola.
        </p>

        <p className="mt-4 max-w-2xl text-base text-neutral-400 md:text-lg">
          Prodotti selezionati,
          preparazioni su misura e un
          macellaio a cui chiedere
          consiglio, quando ne hai bisogno.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <a
            href="#catalogo"
            className="rounded-full bg-red-700 px-8 py-4 text-sm font-bold uppercase tracking-wider text-white hover:bg-red-800"
          >
            Ordina ora
          </a>

          <a
            href="#contatti"
            className="rounded-full border border-white/20 px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-white hover:text-black"
          >
            Contatti
          </a>
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
                    Nessun prodotto
                    disponibile in questa
                    categoria.
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
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold">
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

function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (item: CartItem) => void;
}) {
  const [quantity, setQuantity] =
    useState(
      product.fixedQuantity || "500 g"
    );

  const [added, setAdded] =
    useState(false);

  const [packaging, setPackaging] =
    useState<
      "carta" | "sottovuoto" | "vaschetta" | "altro"
    >("carta");

  const [packageWeightGrams, setPackageWeightGrams] =
    useState<number | "">(500);


  function handleAdd() {
    onAdd({
      productId: product.id,
      name: product.name,
      quantity,
      price: product.price,
      unit: product.unit,
      packaging:
        product.unit === "kg"
          ? packaging
          : undefined,
      packageWeightGrams:
        product.unit === "kg" &&
        packageWeightGrams !== ""
          ? packageWeightGrams
          : undefined,
    });

    setAdded(true);

    setTimeout(() => {
      setAdded(false);
    }, 1500);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex h-36 items-center justify-center bg-neutral-900 p-2 md:h-56 md:p-4">
        <img
          src={product.image}
          alt={product.name}
          onError={(event) => {
            event.currentTarget.src =
              "/images/logo.png";
          }}
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="p-3 md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 md:text-xs">
          {product.category}
        </p>

        <h3 className="mt-2 text-base font-bold md:text-2xl">
          {product.name}
        </h3>

        <p className="mt-1 text-sm text-red-400 md:text-base">
          {product.price}
        </p>

        {product.description && (
          <p className="mt-3 text-xs leading-5 text-neutral-400 md:text-sm">
            {product.description}
          </p>
        )}

        {product.items && (
          <ul className="mt-3 space-y-1 text-xs leading-5 text-neutral-300 md:text-sm">
            {product.items.map(
              (item) => (
                <li key={item}>
                  • {item}
                </li>
              )
            )}
          </ul>
        )}

        {!product.description &&
          !product.items &&
          !product.fixedQuantity && (
            <div className="mt-3 rounded-2xl bg-white/5 p-3 text-xs leading-5 text-neutral-300 md:text-sm">
              <p className="font-semibold text-white">
                Non sai quanto ordinare?
              </p>

              <p className="mt-1">
                Usa il riferimento alle
                porzioni nel menu qui sotto.
                Se hai dubbi, puoi chiedere
                consiglio al macellaio prima
                di inviare l’ordine.
              </p>
            </div>
          )}

        {product.fixedQuantity ? (
          <div className="mt-4 rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white">
            {product.fixedQuantity}
          </div>
        ) : (
          <div className="mt-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-400">
              Scegli quantità
            </label>

            <select
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  e.target.value
                )
              }
              className="w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white"
            >
              {quantityOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>

            {product.unit === "kg" && (
              <div className="mt-4 grid gap-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Confezionamento
                  </label>

                  <select
                    value={packaging}
                    onChange={(e) =>
                      setPackaging(
                        e.target.value as
                          | "carta"
                          | "sottovuoto"
                          | "vaschetta"
                          | "altro"
                      )
                    }
                    className="w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white"
                  >
                    {packagingOptions.map(
                      (option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Peso desiderato per confezione
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      step={1}
                      value={packageWeightGrams}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => {
                        const rawValue = e.target.value;

                        if (rawValue === "") {
                          setPackageWeightGrams("");
                          return;
                        }

                        const value = Number(rawValue);

                        if (Number.isFinite(value)) {
                          setPackageWeightGrams(
                            Math.min(
                              1000,
                              Math.max(1, value)
                            )
                          );
                        }
                      }}
                      onBlur={() => {
                        if (packageWeightGrams === "") {
                          setPackageWeightGrams(500);
                        }
                      }}
                      className="w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white"
                    />

                    <span className="text-sm text-neutral-300">
                      g
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-neutral-400">
                    Il numero di confezioni viene calcolato automaticamente in base alla quantità totale scelta.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleAdd}
          className={`mt-4 w-full rounded-full px-3 py-3 text-xs font-bold uppercase transition md:text-sm ${
            added
              ? "bg-green-600 text-white"
              : "bg-red-700 text-white hover:bg-red-800"
          }`}
        >
          {added
            ? "Aggiunto ✓"
            : "Aggiungi"}
        </button>
      </div>
    </div>
  );
}