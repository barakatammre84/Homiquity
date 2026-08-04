import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { downloadBlobAsFile, downloadResponseAsFile } from "./downloadFile";

describe("downloadFile", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:fake-url");
    revokeObjectURL = vi.fn();
    // happy-dom does not implement the object-URL store.
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clicks an anchor carrying the object URL and requested filename", () => {
    const clicks: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(() => {
          clicks.push(el);
        });
      }
      return el;
    });

    downloadBlobAsFile(new Blob(["hi"]), "letter.pdf");

    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe("letter.pdf");
    expect(clicks[0].getAttribute("href")).toBe("blob:fake-url");
  });

  it("attaches the anchor to the document so Firefox dispatches the click, then removes it", () => {
    let inDocumentAtClick = false;
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(() => {
          inDocumentAtClick = document.body.contains(el);
        });
      }
      return el;
    });

    downloadBlobAsFile(new Blob(["hi"]), "x.pdf");

    expect(inDocumentAtClick).toBe(true);
    // and it does not linger in the DOM afterwards
    expect(document.body.querySelector("a[download]")).toBeNull();
  });

  it("revokes the object URL even when the click throws", () => {
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === "a") {
        vi.spyOn(el, "click").mockImplementation(() => {
          throw new Error("click blew up");
        });
      }
      return el;
    });

    expect(() => downloadBlobAsFile(new Blob(["hi"]), "x.pdf")).toThrow("click blew up");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
  });

  it("downloadResponseAsFile reads the response body as a blob", async () => {
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLAnchorElement;
      if (tag === "a") vi.spyOn(el, "click").mockImplementation(() => {});
      return el;
    });
    const blob = new Blob(["pdf-bytes"]);
    const res = { blob: vi.fn(async () => blob) } as unknown as Response;

    await downloadResponseAsFile(res, "report.pdf");

    expect(res.blob).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledWith(blob);
  });
});
