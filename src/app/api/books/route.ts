import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { query, getClient } from '@/lib/db';
import { authenticateRequest, requireAuth } from '@/lib/auth';

interface Book {
  id: number;
  book_key: string;
  title: string;
  author: string;
  filename: string;
  epub_path: string;
  cover: Buffer | null;
  status: string;
}

// Detect image MIME type from buffer
function getImageMimeType(buffer: Buffer): string {
  if (!buffer || buffer.length < 4) return 'image/jpeg';

  // Check magic bytes
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer[0] === 0x57 && buffer[1] === 0x45 && buffer[2] === 0x42 && buffer[3] === 0x50) {
    return 'image/webp';
  }

  return 'image/jpeg'; // default
}

// Convert book from database to API response
function bookToResponse(book: Book) {
  // Use numeric ID as primary, keep base64 encoded key as legacyId for backward compatibility
  const legacyId = Buffer.from(book.book_key).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  let coverBase64: string | undefined;
  if (book.cover && book.cover.length > 0) {
    const mimeType = getImageMimeType(book.cover);
    coverBase64 = `data:${mimeType};base64,${book.cover.toString('base64')}`;
  }

  return {
    id: book.id,  // Use numeric ID
    legacyId,  // Keep base64 encoded ID for backward compatibility
    title: book.title,
    author: book.author,
    cover: coverBase64,
    filename: book.filename,
    status: book.status,
  };
}

// Parse EPUB file to extract metadata and cover
async function parseEpubMetadata(filePath: string): Promise<{ author: string; cover: Buffer | undefined; title: string }> {
  try {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    // Find the content.opf file
    const opfEntry = zipEntries.find(entry => entry.entryName.endsWith('.opf'));
    if (!opfEntry) {
      return { author: '未知作者', cover: undefined, title: '' };
    }

    const opfContent = opfEntry.getData().toString('utf8');

    // Extract title
    let title = '';
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract author/creator
    let author = '未知作者';
    const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
    if (creatorMatch) {
      author = creatorMatch[1].trim();
    }

    // Find cover image
    let coverBuffer: Buffer | undefined;

    // Method 1: Find cover from meta cover
    const coverMetaMatch = opfContent.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i);
    const coverId = coverMetaMatch ? coverMetaMatch[1] : null;

    if (coverId) {
      const coverItemMatch = opfContent.match(new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"`, 'i'));
      if (coverItemMatch) {
        const coverPath = coverItemMatch[1];
        const coverEntry = zipEntries.find(e => e.entryName.endsWith(coverPath) || e.entryName === coverPath);
        if (coverEntry) {
          coverBuffer = coverEntry.getData();
        }
      }
    }

    // Method 2: Try to find cover-image in manifest
    if (!coverBuffer) {
      const coverImageMatch = opfContent.match(/<item[^>]+properties="cover-image"[^>]+href="([^"]+)"[^>]*>/i);
      if (coverImageMatch) {
        const coverPath = coverImageMatch[1];
        const opfDir = opfEntry.entryName.includes('/') ? opfEntry.entryName.substring(0, opfEntry.entryName.lastIndexOf('/') + 1) : '';
        const fullCoverPath = opfDir + coverPath;

        const coverEntry = zipEntries.find(e => e.entryName === fullCoverPath || e.entryName.endsWith(coverPath));
        if (coverEntry) {
          coverBuffer = coverEntry.getData();
        }
      }
    }

    // Method 3: Try common cover image names
    if (!coverBuffer) {
      const commonNames = ['cover.jpg', 'cover.jpeg', 'cover.png', 'Cover.jpg', 'Cover.jpeg', 'Cover.png'];
      for (const name of commonNames) {
        const coverEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith(name));
        if (coverEntry) {
          coverBuffer = coverEntry.getData();
          break;
        }
      }
    }

    return { author, cover: coverBuffer, title };
  } catch (error) {
    console.error('Error parsing EPUB:', error);
    return { author: '未知作者', cover: undefined, title: '' };
  }
}

export async function GET(request: Request) {
  try {
    // Check authentication
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get books from database - sort by last_read_at first, then updated_at
    const result = await query(
      'SELECT * FROM books ORDER BY COALESCE(last_read_at, updated_at) DESC, id DESC LIMIT $1 OFFSET $2',
      [limit, (page - 1) * limit]
    );

    const countResult = await query('SELECT COUNT(*) as total FROM books');
    const total = parseInt(countResult.rows[0].total);

    // Process books and fetch cover from file if not in DB
    const books = await Promise.all(result.rows.map(async (book) => {
      let coverBuffer = book.cover;

      // If no cover in DB, try to read from EPUB file
      if (!coverBuffer) {
        const epubPath = path.join(process.cwd(), 'data', book.epub_path);
        if (fs.existsSync(epubPath)) {
          try {
            const metadata = await parseEpubMetadata(epubPath);
            coverBuffer = metadata.cover;
          } catch (e) {
            console.error('Error parsing epub for cover:', e);
          }
        }
      }

      return bookToResponse({ ...book, cover: coverBuffer });
    }));

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
