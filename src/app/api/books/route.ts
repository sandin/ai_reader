import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

interface Book {
  id: string;
  title: string;
  author: string;
  cover?: string;
  filename: string;
  status?: 'unread' | 'reading' | 'completed';
}

// Get reading status from bookmark.json
function getBookStatus(bookName: string): 'unread' | 'reading' | 'completed' {
  try {
    const bookmarkPath = path.join(process.cwd(), 'notes', bookName, 'bookmark.json');
    if (fs.existsSync(bookmarkPath)) {
      const content = fs.readFileSync(bookmarkPath, 'utf-8');
      const data = JSON.parse(content);
      return data.status || 'unread';
    }
  } catch (e) {
    // Ignore errors
  }
  return 'unread';
}

// Parse EPUB file to extract metadata and cover
async function parseEpubMetadata(filePath: string): Promise<{ author: string; cover: string | undefined; title: string }> {
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
    let coverBase64: string | undefined;

    // Method 1: Find cover from meta cover
    const coverMetaMatch = opfContent.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i);
    const coverId = coverMetaMatch ? coverMetaMatch[1] : null;

    if (coverId) {
      // Find the item with this id
      const coverItemMatch = opfContent.match(new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"`, 'i'));
      if (coverItemMatch) {
        const coverPath = coverItemMatch[1];
        const coverEntry = zipEntries.find(e => e.entryName.endsWith(coverPath) || e.entryName === coverPath);
        if (coverEntry) {
          const coverData = coverEntry.getData();
          const mimeType = coverPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          coverBase64 = `data:${mimeType};base64,${coverData.toString('base64')}`;
        }
      }
    }

    // Method 2: Try to find cover-image in manifest
    if (!coverBase64) {
      const coverImageMatch = opfContent.match(/<item[^>]+properties="cover-image"[^>]+href="([^"]+)"[^>]*>/i);
      if (coverImageMatch) {
        const coverPath = coverImageMatch[1];
        // Resolve relative path
        const opfDir = opfEntry.entryName.includes('/') ? opfEntry.entryName.substring(0, opfEntry.entryName.lastIndexOf('/') + 1) : '';
        const fullCoverPath = opfDir + coverPath;

        const coverEntry = zipEntries.find(e => e.entryName === fullCoverPath || e.entryName.endsWith(coverPath));
        if (coverEntry) {
          const coverData = coverEntry.getData();
          const mimeType = coverPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          coverBase64 = `data:${mimeType};base64,${coverData.toString('base64')}`;
        }
      }
    }

    // Method 3: Try common cover image names
    if (!coverBase64) {
      const commonNames = ['cover.jpg', 'cover.jpeg', 'cover.png', 'Cover.jpg', 'Cover.jpeg', 'Cover.png'];
      for (const name of commonNames) {
        const coverEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith(name));
        if (coverEntry) {
          const coverData = coverEntry.getData();
          const mimeType = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
          coverBase64 = `data:${mimeType};base64,${coverData.toString('base64')}`;
          break;
        }
      }
    }

    return { author, cover: coverBase64, title };
  } catch (error) {
    console.error('Error parsing EPUB:', error);
    return { author: '未知作者', cover: undefined, title: '' };
  }
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

    const books: Book[] = await Promise.all(
      paginatedFiles.map(async (filename) => {
        // Use URL-safe base64 encoding (replace + with -, / with _, remove padding)
        const id = Buffer.from(filename).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const filePath = path.join(booksDir, filename);
        const metadata = await parseEpubMetadata(filePath);
        const nameWithoutExt = filename.replace('.epub', '');
        const bookStatus = getBookStatus(nameWithoutExt);

        return {
          id,
          title: metadata.title || nameWithoutExt,
          author: metadata.author,
          cover: metadata.cover,
          filename,
          status: bookStatus,
        };
      })
    );

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
