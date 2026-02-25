import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string;
  filename: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');

  const booksDir = path.join(process.cwd(), 'book');

  try {
    const files = fs.readdirSync(booksDir).filter(f => f.endsWith('.epub'));

    const total = files.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedFiles = files.slice(start, end);

    const books: Book[] = paginatedFiles.map((filename, index) => {
      // Use URL-safe base64 encoding (replace + with -, / with _, remove padding)
      const id = Buffer.from(filename).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const nameWithoutExt = filename.replace('.epub', '');
      return {
        id,
        title: nameWithoutExt,
        author: '未知作者',
        filename,
      };
    });

    return NextResponse.json({
      books,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error reading books:', error);
    return NextResponse.json({ error: 'Failed to read books' }, { status: 500 });
  }
}
