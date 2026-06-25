import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (5MB max)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const name = file.name.toLowerCase()

  let text = ''
  try {
    if (name.endsWith('.pdf')) {
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      text = result.text
    } else if (name.endsWith('.txt') || name.endsWith('.md')) {
      text = buffer.toString('utf-8')
    } else {
      return NextResponse.json({ error: 'Unsupported file type — upload a .pdf or .txt resume' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse file — is it a valid, non-scanned PDF?' }, { status: 400 })
  }

  text = text.replace(/\s+/g, ' ').trim()
  if (!text) {
    return NextResponse.json({ error: 'No extractable text found in file' }, { status: 400 })
  }

  return NextResponse.json({ text: text.slice(0, 8000), fileName: file.name })
}
