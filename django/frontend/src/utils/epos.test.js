import { describe, it, expect, beforeEach } from "vitest";
import { getLocalEpos, setLocalEpos, eposUrlFor, resolveEposUrl } from "./epos";

describe("epos IP por computadora", () => {
  beforeEach(() => { localStorage.clear(); });

  it("sin config local usa la URL global del servidor", () => {
    expect(getLocalEpos()).toBeNull();
    const serverUrl = "https://10.0.0.9/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000";
    expect(resolveEposUrl(serverUrl)).toBe(serverUrl);
  });

  it("con config local, esa IP manda sobre la global", () => {
    setLocalEpos("192.168.1.51", "https");
    expect(getLocalEpos()).toEqual({ ip: "192.168.1.51", protocol: "https" });
    const url = resolveEposUrl("https://10.0.0.9/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000");
    expect(url).toBe(eposUrlFor("192.168.1.51", "https"));
    expect(url).toContain("192.168.1.51");
  });

  it("guardar IP vacía borra la config local (vuelve a la global)", () => {
    setLocalEpos("192.168.1.51", "https");
    setLocalEpos("", "https");
    expect(getLocalEpos()).toBeNull();
  });

  it("recorta espacios en la IP", () => {
    setLocalEpos("  192.168.1.52  ", "http");
    expect(getLocalEpos()).toEqual({ ip: "192.168.1.52", protocol: "http" });
  });
});
