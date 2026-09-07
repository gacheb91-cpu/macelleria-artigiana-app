import { NextRequest, NextResponse } from "next/server";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

function streetVariants(street: string) {
  const cleaned = street.replace(/\s+/g, " ").trim();
  const expanded = cleaned.replace(/^v\.le\s*/i, "Viale ").replace(/^v\.\s*/i, "Via ").replace(/^c\.so\s*/i, "Corso ").replace(/^p\.zza\s*/i, "Piazza ").replace(/^p\.le\s*/i, "Piazzale ");
  const withoutPrefix = expanded.replace(/^(via|viale|corso|piazza|piazzale|vicolo|largo|strada)\s+/i, "").trim();
  return [...new Set([expanded, withoutPrefix])].filter((value) => /[a-zà-ÿ]/i.test(value));
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const street = searchParams.get("street")?.trim();
  const city = searchParams.get("city")?.trim();
  const postalcode = searchParams.get("postalcode")?.trim();

  if (!street || !city || !postalcode) {
    return NextResponse.json(
      {
        success: false,
        message: "Indirizzo, città e CAP sono obbligatori.",
      },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    street,
    city,
    postalcode,
    country: "Italia",
    countrycodes: "it",
    format: "jsonv2",
    limit: "1",
  });

  try {
    let results: NominatimResult[] = [];
    const variants = streetVariants(street);
    for (let index = 0; index < variants.length; index++) {
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100));
      params.set("street", variants[index]);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { "User-Agent": "MacelleriaArtigiana/1.0 (macelleriaartigiana@gmail.com)", "Accept-Language": "it" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return NextResponse.json({ success: false, message: "Il servizio di verifica dell'indirizzo non è disponibile. Riprova tra poco." }, { status: 502 });
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid geocoding response");
      results = data as NominatimResult[];
      if (results.length) break;
    }

    if (!results.length) {
      return NextResponse.json({
        success: false,
        message:
          "Indirizzo non trovato. Controlla via, numero civico, città e CAP.",
      });
    }

    const result = results[0];

    const latitude = Number(result.lat);
    const longitude = Number(result.lon);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Non è stato possibile determinare la posizione dell'indirizzo.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      latitude,
      longitude,
      displayName: result.display_name,
    });
  } catch (error) {
    console.error("Errore geocodifica:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Errore durante la verifica dell'indirizzo.",
      },
      { status: 500 }
    );
  }
}