"use client";

// ============================================================================
// PDFUploadDropzone — drag-and-drop (or click-to-browse) PDF ingestion.
// Uploads to Supabase Storage, registers the books row, then triggers
// server-side text extraction so the book is RSVP-ready on completion.
// ============================================================================

import { useCallback, useRef, useState, type DragEvent } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Loader2, UploadCloud, XCircle } from "lucide-react";
import {
  BookUploadError,
  MAX_PDF_BYTES,
  uploadAndExtractBook,
  type UploadPhase,
} from "@/lib/books";
import type { Book } from "@/lib/types";

type DropState =
  | { kind: "idle" }
  | { kind: "busy"; phase: UploadPhase; fileName: string }
  | { kind: "done"; book: Book }
  | { kind: "error"; message: string };

export interface PDFUploadDropzoneProps {
  /** Fires once the book is uploaded AND its text is extracted. */
  onBookReady: (book: Book) => void;
}

export default function PDFUploadDropzone({ onBookReady }: PDFUploadDropzoneProps) {
  const [state, setState] = useState<DropState>({ kind: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingest = useCallback(
    async (file: File) => {
      setState({ kind: "busy", phase: "uploading", fileName: file.name });
      try {
        const book = await uploadAndExtractBook(file, (phase) =>
          setState({ kind: "busy", phase, fileName: file.name })
        );
        setState({ kind: "done", book });
        onBookReady(book);
      } catch (err) {
        setState({
          kind: "error",
          message:
            err instanceof BookUploadError
              ? err.message
              : "Unexpected upload failure — try again.",
        });
      }
    },
    [onBookReady]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (state.kind === "busy") return;
      const file = e.dataTransfer.files?.[0];
      if (file) void ingest(file);
    },
    [ingest, state.kind]
  );

  const busy = state.kind === "busy";

  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF book"
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition
          ${
            dragActive
              ? "border-accent bg-accent/10"
              : "border-neutral-700 bg-surface-raised hover:border-accent-soft"
          }
          ${busy ? "cursor-wait opacity-80" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void ingest(file);
            e.target.value = ""; // allow re-selecting the same file
          }}
        />

        {state.kind === "busy" ? (
          <>
            <Loader2 size={36} className="animate-spin text-accent-soft" />
            <p className="font-medium text-neutral-200">
              {state.phase === "uploading"
                ? `Uploading ${state.fileName}…`
                : "Extracting text for the RSVP engine…"}
            </p>
            <p className="text-xs text-neutral-500">
              {state.phase === "extracting" &&
                "Parsing pages, de-hyphenating line breaks, counting words."}
            </p>
          </>
        ) : state.kind === "done" ? (
          <>
            <CheckCircle2 size={36} className="text-emerald-400" />
            <p className="font-medium text-neutral-200">{state.book.title}</p>
            <p className="text-xs text-neutral-500">
              {state.book.word_count.toLocaleString()} words extracted — ready to
              sprint. Drop another PDF to add a second book.
            </p>
          </>
        ) : (
          <>
            <motion.div
              animate={dragActive ? { scale: 1.15 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <UploadCloud
                size={36}
                className={dragActive ? "text-accent" : "text-neutral-500"}
              />
            </motion.div>
            <p className="font-medium text-neutral-200">
              Drop a PDF here, or click to browse
            </p>
            <p className="flex items-center gap-1.5 text-xs text-neutral-500">
              <FileText size={12} />
              PDF only · up to {Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB ·
              text is extracted automatically
            </p>
          </>
        )}
      </div>

      {state.kind === "error" && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-300">
          <XCircle size={15} className="shrink-0" />
          {state.message}
        </p>
      )}
    </div>
  );
}
