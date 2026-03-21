import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://libmo.syu.ac.kr/mobile/PA/seatRoomStatusListXML.php",
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const text = await response.text();

    // XML에서 데이터 추출
    const roomRegex =
      /<item>[\s\S]*?<strRoomNm><!\[CDATA\[([^\]]+)\]\]><\/strRoomNm>[\s\S]*?<strTotalSeat><!\[CDATA\[([^\]]+)\]\]><\/strTotalSeat>[\s\S]*?<strUseSeat><!\[CDATA\[([^\]]+)\]\]><\/strUseSeat>[\s\S]*?<strRemainSeat><!\[CDATA\[([^\]]+)\]\]><\/strRemainSeat>[\s\S]*?<\/item>/g;

    const rooms = [];
    let match;

    while ((match = roomRegex.exec(text)) !== null) {
      rooms.push({
        id: rooms.length,
        strRoomNm: match[1],
        strTotalSeat: parseInt(match[2]),
        strUseSeat: parseInt(match[3]),
        strRemainSeat: parseInt(match[4]),
        lastUpdated: new Date().toISOString(),
      });
    }

    return NextResponse.json(rooms);
  } catch (error) {
    console.error("Failed to fetch reading rooms:", error);
    return NextResponse.json(
      { error: "Failed to fetch reading room status" },
      { status: 500 },
    );
  }
}
