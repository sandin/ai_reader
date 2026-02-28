import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Handle URL-safe base64: replace - with + and _ with /
  const standardBase64 = id.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = standardBase64 + '=='.slice(0, (4 - standardBase64.length % 4) % 4);
  const filename = Buffer.from(padded, 'base64').toString('utf-8');
  const filepath = path.join(process.cwd(), 'data', 'books', filename);

  try {
    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 });
    }

    const bookBuffer = fs.readFileSync(filepath);
    // Return book content as base64 for epubjs to parse navigation
    const bookBase64 = bookBuffer.toString('base64');

    return NextResponse.json({
      id,
      filename,
      title: filename.replace('.epub', ''),
      content: bookBase64,
    });
  } catch (error) {
    console.error('Error reading book:', error);
    return NextResponse.json({ error: 'Failed to read book' }, { status: 500 });
  }
}
