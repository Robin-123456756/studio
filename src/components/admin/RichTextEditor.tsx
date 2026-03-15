"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

/* ── Style tokens (admin dark theme) ───────────────────────────────────── */

const SURFACE = "#1A2236";
const BORDER = "#1E293B";
const ACCENT = "#00E676";
const TEXT = "#F1F5F9";
const MUTED = "#64748B";

/* ── Toolbar button ────────────────────────────────────────────────────── */

function TBBtn({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "4px 8px",
        fontSize: 13,
        fontWeight: 700,
        borderRadius: 4,
        border: "none",
        background: active ? ACCENT + "30" : "transparent",
        color: active ? ACCENT : TEXT,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

/* ── Component ─────────────────────────────────────────────────────────── */

type Props = {
  value: string; // HTML string
  onChange: (html: string) => void;
  maxLength?: number;
  placeholder?: string;
};

export default function RichTextEditor({
  value,
  onChange,
  maxLength = 2000,
  placeholder = "Write your story...",
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      // Enforce max length on plain text
      const plain = e.getText();
      if (plain.length <= maxLength) {
        onChange(html);
      }
    },
    editorProps: {
      attributes: {
        style: [
          `min-height: 120px`,
          `padding: 12px`,
          `color: ${TEXT}`,
          `font-size: 14px`,
          `line-height: 1.6`,
          `outline: none`,
        ].join(";"),
      },
    },
  });

  // Sync external value only on first render (avoid cursor reset)
  useEffect(() => {
    if (editor && !editor.isFocused && value === "") {
      editor.commands.setContent("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const charCount = editor.getText().length;

  function addLink() {
    const url = prompt("Enter URL:");
    if (!url) return;
    // Block javascript: and data: URIs to prevent XSS
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      alert("Only http:// and https:// links are allowed.");
      return;
    }
    editor!.chain().focus().setLink({ href: trimmed }).run();
  }

  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        background: SURFACE,
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          padding: "6px 8px",
          borderBottom: `1px solid ${BORDER}`,
          background: "#111827",
        }}
      >
        <TBBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          B
        </TBBtn>
        <TBBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </TBBtn>
        <TBBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading"
        >
          H2
        </TBBtn>
        <TBBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Subheading"
        >
          H3
        </TBBtn>
        <TBBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          &bull; List
        </TBBtn>
        <TBBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </TBBtn>
        <TBBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          &ldquo;&rdquo;
        </TBBtn>
        <TBBtn
          active={editor.isActive("link")}
          onClick={addLink}
          title="Add link"
        >
          Link
        </TBBtn>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />

      {/* Char count */}
      <div
        style={{
          textAlign: "right",
          padding: "4px 10px",
          fontSize: 11,
          color: charCount > maxLength * 0.9 ? "#EF4444" : MUTED,
        }}
      >
        {charCount}/{maxLength}
      </div>
    </div>
  );
}
