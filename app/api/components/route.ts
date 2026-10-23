import { NextRequest, NextResponse } from "next/server";

type ComponentRecord = { id: string; tag: string; description: string; failureRate: number; mttr: number };
const records: ComponentRecord[] = [];

export async function GET() {
  return NextResponse.json({ data: records, count: records.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.tag || !body.description || Number(body.failureRate) < 0 || Number(body.mttr) < 0) {
    return NextResponse.json({ error: "tag, description and non-negative reliability values are required" }, { status: 400 });
  }
  const record: ComponentRecord = { id: crypto.randomUUID(), tag: String(body.tag), description: String(body.description), failureRate: Number(body.failureRate || 0), mttr: Number(body.mttr || 0) };
  records.push(record);
  return NextResponse.json(record, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) return NextResponse.json({ error: "Component not found" }, { status: 404 });
  records.splice(index, 1);
  return new NextResponse(null, { status: 204 });
}
