import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  const booksDir = path.join(process.cwd(), 'data', 'books');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.epub')) {
      return NextResponse.json({ error: 'Only EPUB files are allowed' }, { status: 400 });
    }

    // Check if file already exists
    const filePath = path.join(booksDir, file.name);
    if (fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File already exists' }, { status: 409 });
    }

    // Save the file
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    return NextResponse.json({
      success: true,
      filename: file.name,
      message: 'Book uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading book:', error);
    return NextResponse.json({ error: 'Failed to upload book' }, { status: 500 });
  }
}
