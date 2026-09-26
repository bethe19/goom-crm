import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { renderMarkdown } from "@/lib/sanitize";

/** Read-only rendering of note markdown (safe: see renderMarkdown). */
export function MarkdownView({ value, className }: { value: string; className?: string }) {
  return (
    <div
      className={className ?? "text-sm leading-relaxed text-foreground/90 break-words"}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
    />
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, rows = 3, placeholder }: RichTextEditorProps) {
  return (
    <Tabs defaultValue="write" className="w-full">
      <TabsList className="h-8">
        <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
        <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
      </TabsList>
      <TabsContent value="write" className="mt-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder || "Supports **bold**, *italic*, [links](url), and - lists"}
        />
      </TabsContent>
      <TabsContent value="preview" className="mt-2">
        <div
          className="min-h-[60px] rounded-md border bg-muted/30 p-3 text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: value ? renderMarkdown(value) : '<span class="text-muted-foreground">Nothing to preview</span>' }}
        />
      </TabsContent>
    </Tabs>
  );
}
