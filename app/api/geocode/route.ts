import { NextRequest, NextResponse } from "next/server";

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
};

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
    format: "jsonv2",
    limit: "1",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "User-Agent":
            "MacelleriaArtigiana/1.0 (macelleriaartigiana@gmail.com)",
          "Accept-Language": "it",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Il servizio di verifica dell'indirizzo non è disponibile.",
        },
        { status: 502 }
      );
    }

    const results = (await response.json()) as NominatimResult[];

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
      !Number.isFinite(longitude)
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