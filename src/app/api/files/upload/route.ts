// src/app/api/files/upload/route.ts
// =============================================================================
// MehmanGhar Financial OS — File Upload Route
//
// POST — upload a file to Supabase Storage via storage.ts adapter.
//        Accepts multipart/form-data with fields:
//          file        — the file blob
//          bucket      — storage bucket name (default: "mg-finance-os")
//          path        — full storage path (e.g. invoices/prop-id/2025/03/exp-id.jpg)
//
// Returns: { path, originalSize, finalSize, compressed }
//
// Compression (server-side, using sharp):
//   Images (JPEG, PNG, WebP) → converted to WebP at quality 82.
//     WebP is 25-35% smaller than JPEG at equivalent visual quality.
//     Quality 82 is visually near-lossless for invoice/receipt photos.
//     The storage path extension is updated to .webp automatically.
//   PDFs → passed through untouched. PDFs are already deflate-compressed
//     internally; re-processing without a full PDF engine damages them.
//
// Enforces:
//   - Max file size: 5 MB (pre-compression, enforced server-side)
//   - Allowed MIME types: image/jpeg, image/png, image/webp, application/pdf
//   - Authentication: any logged-in role (role header checked)
//   - Only calls uploadFile() from storage.ts — never imports supabase-js
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { uploadFile } from "@/lib/storage";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BYTES      = 5 * 1024 * 1024; // 5 MB pre-compression limit
const DEFAULT_BUCKET = process.env.STORAGE_BUCKET ?? "mg-finance-os";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// WebP quality — 82 is visually near-lossless for receipts/invoices
// while reducing file size 25-35% vs JPEG. Range: 1-100.
const WEBP_QUALITY = 82;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface UploadResponse {
  path:         string;
  originalSize: number;
  finalSize:    number;
  compressed:   boolean;
}

interface ErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// Compress image to WebP using sharp
// ---------------------------------------------------------------------------

async function compressImage(
  inputBuffer: Buffer,
  storagePath: string,
): Promise<{ buffer: Buffer; contentType: string; path: string }> {
  const sharp = (await import("sharp")).default;

  const compressed = await sharp(inputBuffer)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();

  // Replace the file extension in the storage path with .webp
  const updatedPath = storagePath.replace(/\.(jpe?g|png|webp)$/i, ".webp");

  return {
    buffer:      compressed,
    contentType: "image/webp",
    path:        updatedPath,
  };
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<UploadResponse | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";
  if (!role) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data body." },
      { status: 400 }
    );
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File)) {
    return NextResponse.json(
      { error: "Field \"file\" is required and must be a file." },
      { status: 422 }
    );
  }

  const pathEntry = formData.get("path");
  if (typeof pathEntry !== "string" || pathEntry.trim() === "") {
    return NextResponse.json(
      { error: "Field \"path\" is required and must be a non-empty string." },
      { status: 422 }
    );
  }

  const bucket =
    typeof formData.get("bucket") === "string" && (formData.get("bucket") as string).trim()
      ? (formData.get("bucket") as string).trim()
      : DEFAULT_BUCKET;

  const storagePath = pathEntry.trim();
  const contentType = fileEntry.type || "application/octet-stream";

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: `File type "${contentType}" is not allowed. Accepted: JPEG, PNG, WebP, PDF.` },
      { status: 422 }
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds 5 MB limit (received ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB).` },
      { status: 422 }
    );
  }

  const originalBuffer = Buffer.from(arrayBuffer);
  const originalSize   = originalBuffer.byteLength;

  let finalBuffer:      Buffer  = originalBuffer;
  let finalContentType: string  = contentType;
  let finalPath:        string  = storagePath;
  let compressed:       boolean = false;

  if (IMAGE_MIME_TYPES.has(contentType)) {
    try {
      const result = await compressImage(originalBuffer, storagePath);
      finalBuffer      = result.buffer;
      finalContentType = result.contentType;
      finalPath        = result.path;
      compressed       = true;
    } catch (err) {
      // Compression failed — upload original rather than block the user
      console.error("[upload] Compression failed, uploading original:", err);
    }
  }
  // PDFs: no compression — pass through unchanged

  try {
    const { path: confirmedPath } = await uploadFile(bucket, finalPath, finalBuffer, finalContentType);
    return NextResponse.json({
      path:         confirmedPath,
      originalSize,
      finalSize:    finalBuffer.byteLength,
      compressed,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
