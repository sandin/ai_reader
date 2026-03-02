import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  let auth;
  try {
    auth = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = auth;
  const userBooksDir = path.join(process.cwd(), 'data', String(userId), 'books');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.epub')) {
      return NextResponse.json({ error: 'Only EPUB files are allowed' }, { status: 400 });
    }

    // Create user books directory if it doesn't exist
    if (!fs.existsSync(userBooksDir)) {
      fs.mkdirSync(userBooksDir, { recursive: true });
    }

    // Check if file already exists in database
    const bookKey = file.name.replace('.epub', '');
    const existingBook = await query(
      'SELECT id FROM books WHERE book_key = $1',
      [bookKey]
    );

    if (existingBook.rows.length > 0) {
      return NextResponse.json({ error: 'Book already exists' }, { status: 409 });
    }

    // Save the file
    const filePath = path.join(userBooksDir, file.name);
    const buffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Parse EPUB metadata
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    let title = bookKey;
    let author = '未知作者';
    let coverBuffer: Buffer | null = null;

    // Find the content.opf file
    const opfEntry = zipEntries.find(entry => entry.entryName.endsWith('.opf'));
    if (opfEntry) {
      const opfContent = opfEntry.getData().toString('utf8');

      // Extract title
      const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }

      // Extract author
      const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
      if (creatorMatch) {
        author = creatorMatch[1].trim();
      }

      // Method 1: Extract cover from meta cover
      const coverMetaMatch = opfContent.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i);
      const coverId = coverMetaMatch ? coverMetaMatch[1] : null;

      if (coverId && !coverBuffer) {
        const coverItemMatch = opfContent.match(new RegExp(`<item[^>]+id="${coverId}"[^>]+href="([^"]+)"`, 'i'));
        if (coverItemMatch) {
          const coverPath = coverItemMatch[1];
          const opfDir = opfEntry.entryName.includes('/') ? opfEntry.entryName.substring(0, opfEntry.entryName.lastIndexOf('/') + 1) : '';
          const fullCoverPath = opfDir + coverPath;
          const coverEntry = zipEntries.find(e => e.entryName === fullCoverPath || e.entryName.endsWith(coverPath));
          if (coverEntry) {
            coverBuffer = coverEntry.getData();
          }
        }
      }

      // Method 2: Extract cover from properties="cover-image"
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
        const commonNames = ['cover.jpg', 'cover.jpeg', 'cover.png', 'Cover.jpg', 'Cover.jpeg', 'Cover.png', 'cover-image.jpg', 'cover-image.jpeg', 'cover-image.png'];
        for (const name of commonNames) {
          const coverEntry = zipEntries.find(e => e.entryName.toLowerCase().endsWith(name));
          if (coverEntry) {
            coverBuffer = coverEntry.getData();
            break;
          }
        }
      }
    }

    // Save to database
    const epubPath = `${userId}/books/${file.name}`;
    const now = Math.floor(Date.now());

    await query(
      `INSERT INTO books (book_key, title, author, filename, epub_path, cover, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [bookKey, title, author, file.name, epubPath, coverBuffer, 'unread', now, now]
    );

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
