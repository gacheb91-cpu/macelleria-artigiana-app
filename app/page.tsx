"use client";

import { useEffect, useState } from "react";

const WHATSAPP_NUMBER = "393513912335";
const BOX_CATEGORY = "Box Selezione Macelleria Artigiana";

const products = [
  { category: "Pollo", name: "Petto di pollo", price: "€13,90/kg", image: "/images/petto-pollo.jpg" },
  { category: "Pollo", name: "Cosce di pollo", price: "€8,90/kg", image: "/images/cosce-pollo.jpg" },
  { category: "Pollo", name: "Ali di pollo", price: "€5,90/kg", image: "/images/ali-pollo.jpg" },

  { category: "Tacchino", name: "Tacchino a fette", price: "€14,90/kg", image: "/images/tacchino-fette.jpg" },

  { category: "Manzo / Vitello", name: "Macinato misto per ragù", price: "€9,90/kg", image: "/images/macinato-ragu.jpg" },
  { category: "Manzo / Vitello", name: "Macinato magro", price: "€15,90/kg", image: "/images/macinato-magro.jpg" },
  { category: "Manzo / Vitello", name: "Scamone a fette", price: "€24,90/kg", image: "/images/scamone.jpg" },
  { category: "Manzo / Vitello", name: "Pizzaiola", price: "€19,90/kg", image: "/images/pizzaiola.jpg" },
  { category: "Manzo / Vitello", name: "Roastbeef a fette", price: "€29,90/kg", image: "/images/roastbeef.jpg" },
  { category: "Manzo / Vitello", name: "Fesa a fette", price: "€20,90/kg", image: "/images/fesa.jpg" },
  { category: "Manzo / Vitello", name: "Costate con osso", price: "€27,90/kg", image: "/images/costata.jpg" },
  { category: "Manzo / Vitello", name: "Arrosto di vitello", price: "€19,90/kg", image: "/images/arrosto-vitello.jpg" },
  { category: "Manzo / Vitello", name: "Spezzatino di vitello", price: "€16,90/kg", image: "/images/spezzatino-vitello.jpg" },

  { category: "Suino", name: "Salsiccia fresca", price: "€12,90/kg", image: "/images/salsiccia.jpg" },
  { category: "Suino", name: "Salamelle fresche", price: "€12,90/kg", image: "/images/salamelle.jpg" },
  { category: "Suino", name: "Costine suino", price: "€9,90/kg", image: "/images/costine-suino.jpg" },
  { category: "Suino", name: "Lonza", price: "€10,90/kg", image: "/images/lonza.jpg" },
  { category: "Suino", name: "Braciole di coppa", price: "€9,90/kg", image: "/images/braciole.jpg" },
  { category: "Suino", name: "Cotolette di suino", price: "€9,90/kg", image: "/images/cotolette-suino.jpg" },

  { category: "Hamburger", name: "Hamburger di pollo", price: "€14,90/kg", image: "/images/hamburger-pollo.jpg" },
  { category: "Hamburger", name: "Hamburger bovino adulto", price: "€15,90/kg", image: "/images/hamburger-bovino.jpg" },
  { category: "Hamburger", name: "Hamburger di vitello", price: "€16,90/kg", image: "/images/hamburger-vitello.jpg" },
  { category: "Hamburger", name: "Hamburger di tacchino", price: "€14,90/kg", image: "/images/hamburger-tacchino.jpg" },
  { category: "Hamburger", name: "Hamburger misto bovino/suino", price: "€12,90/kg", image: "/images/hamburger-misto.jpg" },

  {
    category: BOX_CATEGORY,
    name: "Box Fitness Base",
    price: "€35",
    image: "/images/box-fitness-base.jpg",
    fixedQuantity: "1 box",
    description: "Una selezione semplice e pratica per chi vuole organizzare pasti proteici durante la settimana.",
    items: ["Petto di pollo 1 kg", "Macinato magro 500 g", "Tacchino 500 g"],
  },
  {
    category: BOX_CATEGORY,
    name: "Box Fitness Plus",
    price: "€55",
    image: "/images/box-fitness-plus.jpg",
    fixedQuantity: "1 box",
    description: "Pensato per chi cerca più varietà e una scorta completa di proteine magre.",
    items: ["Petto di pollo 1,5 kg", "Macinato magro 1 kg", "Hamburger magri x5", "Tacchino 1 kg"],
  },
  {
    category: BOX_CATEGORY,
    name: "Box Famiglia",
    price: "€75",
    image: "/images/box-famiglia.jpg",
    fixedQuantity: "1 box",
    description: "Una soluzione comoda e completa per organizzare diversi pasti in famiglia.",
    items: ["Arrosto 1 kg", "Spezzatino 1 kg", "Fettine bovino 1 kg", "Petto pollo 1 kg", "Salsiccia 500 g"],
  },
  {
    category: BOX_CATEGORY,
    name: "Box Grigliata x4",
    price: "Prezzo da confermare",
    image: "/images/box-grigliata.jpg",
    fixedQuantity: "1 box",
    description: "Una selezione pensata per una grigliata ricca, pratica e pronta da condividere.",
    items: ["Costine", "Salsiccia fresca", "Salamelle", "Spiedini misti", "Tagliata di manzo"],
  },
];

const categories = [
  "Tutti",
  BOX_CATEGORY,
  "Pollo",
  "Tacchino",
  "Manzo / Vitello",
  "Suino",
  "Hamburger",
];

type Product = {
  category: string;
  name: string;
  price: string;
  image: string;
  description?: string;
  fixedQuantity?: string;
  items?: string[];
};

type CartItem = {
  name: string;
  quantity: string;
  price: string;
};

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState("Tutti");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryMode, setDeliveryMode] = useState(
    "Ritiro in sede - Via Roma 15, Castellanza"
  );
  const [notes, setNotes] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [allergensAccepted, setAllergensAccepted] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const filteredProducts =
    selectedCategory === "Tutti"
      ? products
      : products.filter((product) => product.category === selectedCategory);

  function addToCart(item: CartItem) {
    setCart([...cart, item]);
  }

  function removeFromCart(indexToRemove: number) {
    setCart(cart.filter((_, index) => index !== indexToRemove));
  }

  async function handleInstall() {
    if (!installPrompt) return;

    installPrompt.prompt();
    const result = await installPrompt.userChoice;

    if (result.outcome === "accepted") {
      setShowInstallBanner(false);
    }
  }

  function sendOrder() {
    if (!customerName || !phone || cart.length === 0) {
      alert("Inserisci nome, telefono e almeno un prodotto nel carrello.");
      return;
    }

    if (!privacyAccepted || !allergensAccepted) {
      alert("Per inviare l’ordine devi accettare privacy e informativa allergeni.");
      return;
    }

    const message = `
NUOVO ORDINE - MACELLERIA ARTIGIANA

Nome: ${customerName}
Telefono: ${phone}
Modalità: ${deliveryMode}

Prodotti:
${cart.map((item) => `- ${item.name} — ${item.quantity} — ${item.price}`).join("\n")}

Note:
${notes}

Cliente informato su privacy e allergeni.
Il peso finale può variare leggermente in base al taglio reale.
`;

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      message
    )}`;

    window.open(url, "_blank");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      {showInstallBanner && (
        <div className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl border border-white/10 bg-black/95 p-5 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">
                Installa Macelleria Artigiana
              </p>

              <p className="mt-1 text-xs text-neutral-400">
                Aggiungi l’app alla schermata Home per un accesso più veloce.
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setShowInstallBanner(false)}
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

      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <img
          src="/images/logo.png"
          alt="Macelleria Artigiana"
          className="mb-8 h-32 w-32 rounded-full object-contain"
        />

        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-red-500">
          Macelleria Artigiana
        </p>

        <h1 className="max-w-4xl text-5xl font-bold leading-tight md:text-7xl">
          Tradizione, nutrizione e innovazione su misura.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-neutral-300">
          Carne selezionata, box personalizzati e ordini su misura per sportivi,
          famiglie e amanti della qualità.
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
            Una macelleria artigiana pensata per chi vuole mangiare bene.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-neutral-700">
            Macelleria Artigiana nasce dall’esperienza nel lavoro della carne,
            dalla cura per i dettagli e dal desiderio di offrire un servizio più
            vicino alle esigenze reali delle persone. Non siamo solo una
            macelleria: siamo un laboratorio su misura dove qualità, tradizione
            e praticità si incontrano.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-neutral-700">
            Prepariamo prodotti selezionati, porzionati con attenzione e pensati
            per famiglie, sportivi e clienti che vogliono organizzare meglio la
            propria alimentazione. Puoi scegliere prodotti al kg, box già
            studiati o ordini personalizzati.
          </p>

          <p className="mx-auto mt-4 max-w-3xl text-lg leading-8 text-neutral-700">
            Puoi ritirare in sede in Via Roma 15 a Castellanza oppure concordare
            la consegna nel luogo e nell’orario più comodi per te.
          </p>
        </div>
      </section>

      <section id="catalogo" className="px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold">Catalogo prodotti</h2>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${
                  selectedCategory === category
                    ? "bg-red-700 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.name}
                product={product}
                onAdd={addToCart}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20 text-neutral-950">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold">Checkout ordine</h2>

          {cart.length === 0 ? (
            <p className="mt-4 text-neutral-600">Il carrello è ancora vuoto.</p>
          ) : (
            <div className="mt-6 space-y-3">
              {cart.map((item, index) => (
                <div
                  key={`${item.name}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-neutral-100 p-4 font-medium"
                >
                  <span>
                    {item.name} — {item.quantity} — {item.price}
                  </span>

                  <button
                    onClick={() => removeFromCart(index)}
                    className="rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-10 grid gap-4">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome e cognome"
              className="rounded-2xl border p-4"
            />

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Telefono"
              className="rounded-2xl border p-4"
            />

            <select
              value={deliveryMode}
              onChange={(e) => setDeliveryMode(e.target.value)}
              className="rounded-2xl border p-4"
            >
              <option>Ritiro in sede - Via Roma 15, Castellanza</option>
              <option>Consegna concordata</option>
            </select>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note: taglio, sottovuoto, orario, indirizzo, allergeni..."
              className="min-h-32 rounded-2xl border p-4"
            />

            <label className="flex gap-3 rounded-2xl bg-neutral-100 p-4 text-sm">
              <input
                type="checkbox"
                checked={allergensAccepted}
                onChange={(e) => setAllergensAccepted(e.target.checked)}
              />
              <span>Ho letto l’informativa allergeni.</span>
            </label>

            <label className="flex gap-3 rounded-2xl bg-neutral-100 p-4 text-sm">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(e) => setPrivacyAccepted(e.target.checked)}
              />
              <span>Ho letto e accetto l’informativa privacy.</span>
            </label>

            <button
              onClick={sendOrder}
              className="rounded-full bg-green-600 px-6 py-4 font-bold uppercase text-white hover:bg-green-700"
            >
              Invia ordine su WhatsApp
            </button>
          </div>
        </div>
      </section>

      <section id="contatti" className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-sm font-bold uppercase tracking-[0.3em] text-red-500">
            Contatti
          </p>

          <h2 className="mt-4 text-center text-3xl font-bold md:text-5xl">
            Vieni a trovarci o contattaci per il tuo ordine.
          </h2>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl bg-white/5 p-6">
              <h3 className="text-xl font-bold">Macelleria Artigiana</h3>
              <p className="mt-4 text-neutral-300">Via Roma 15, Castellanza (VA)</p>
              <p className="mt-2 text-neutral-300">Telefono: +39 351 391 2335</p>
              <p className="mt-2 text-neutral-300">Email: info@macelleriaartigiana.it</p>
            </div>

            <div className="rounded-3xl bg-white/5 p-6">
              <h3 className="text-xl font-bold">Orari</h3>
              <p className="mt-4 text-neutral-300">Dal lunedì al sabato</p>
              <p className="mt-2 text-neutral-300">08:30 - 19:30</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-neutral-500">
        © Macelleria Artigiana — Via Roma 15, Castellanza (VA) — info@macelleriaartigiana.it
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
  const [quantity, setQuantity] = useState(product.fixedQuantity || "500 g");
  const [added, setAdded] = useState(false);

  function handleAdd() {
    onAdd({
      name: product.name,
      quantity,
      price: product.price,
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
          className="max-h-full max-w-full object-contain"
        />
      </div>

      <div className="p-3 md:p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 md:text-xs">
          {product.category}
        </p>

        <h3 className="mt-2 text-base font-bold md:text-2xl">{product.name}</h3>
        <p className="mt-1 text-sm text-red-400 md:text-base">{product.price}</p>

        {product.description && (
          <p className="mt-3 text-xs leading-5 text-neutral-400 md:text-sm">
            {product.description}
          </p>
        )}

        {product.items && (
          <ul className="mt-3 space-y-1 text-xs leading-5 text-neutral-300 md:text-sm">
            {product.items.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        )}

        {!product.description && !product.items && (
          <p className="mt-3 hidden text-neutral-400 md:block">
            Seleziona la quantità desiderata. Il peso finale può variare leggermente.
          </p>
        )}

        {product.fixedQuantity ? (
          <div className="mt-4 rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white">
            {product.fixedQuantity}
          </div>
        ) : (
          <select
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="mt-4 w-full rounded-2xl border border-white/20 bg-neutral-900 p-3 text-sm text-white"
          >
            <option>250 g</option>
            <option>500 g</option>
            <option>1 kg</option>
            <option>1,5 kg</option>
            <option>2 kg</option>
            <option>Quantità personalizzata nelle note</option>
          </select>
        )}

        <button
          onClick={handleAdd}
          className={`mt-4 w-full rounded-full px-3 py-3 text-xs font-bold uppercase transition md:text-sm ${
            added
              ? "bg-green-600 text-white"
              : "bg-red-700 text-white hover:bg-red-800"
          }`}
        >
          {added ? "Aggiunto ✓" : "Aggiungi"}
        </button>
      </div>
    </div>
  );
}
// aggiornamento homepage