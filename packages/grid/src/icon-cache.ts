export class IconImageCache {
  private images = new Map<string, HTMLImageElement | "error">();

  constructor(private readonly onLoad: () => void) {}

  get(url: string): HTMLImageElement | null {
    if (!url) return null;
    const existing = this.images.get(url);
    if (existing === "error") return null;
    if (existing) {
      if (existing.complete && existing.naturalWidth > 0) return existing;
      return null;
    }
    const img = new Image();
    img.decoding = "async";
    img.onload = () => this.onLoad();
    img.onerror = () => {
      this.images.set(url, "error");
    };
    img.src = url;
    this.images.set(url, img);
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
}