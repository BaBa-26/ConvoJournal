import Link from "next/link";

// Themed 404 for any unmatched route.
export default function NotFound() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen gap-6 px-8 text-center animate-fade-in">
      <p className="font-display italic text-6xl text-gold/50">404</p>
      <div className="space-y-2">
        <h2 className="font-display italic text-2xl text-parchment-200">Page not found</h2>
        <p className="font-mono text-xs text-parchment-700 leading-6">
          That page doesn&apos;t exist or has moved.
        </p>
      </div>
      <Link href="/" className="btn-primary px-6">Go home</Link>
    </div>
  );
}
